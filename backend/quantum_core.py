#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QuantumSentry Core Logic
Module: quantum_core.py

基于论文 “Neural Algorithm Aided Operation of CO2 Electrolyzers”
(ACS Energy Letters 2025) 的建模启发，我们将 CO2 电解槽操作抽象为：

输入参数（论文中的 5 个输入）:
- current (这里用 current_density, mA/cm2)
- cell temperature (temperature, °C)
- gas humidifier temperature (gh_temperature, °C) —— 决定进料湿度
- CO2 inlet flow rate (co2_flow, 归一化到 cm3 min-1 cm-2 的量级)
- anolyte electric conductivity (anolyte_ec, 这里用归一化特征表示)

关键输出/优化 KPI（与费曼动力赛题对齐）:
- Voltage
- FE(CO)
- SPC (single-pass conversion)

QUBO 总能量（哈密顿量）采取“一套静态拓扑、多模板动态权重”的策略：

E(x) = ω_phys * H_physics(x) + ω_obj(template) * H_objective(x)

- H_physics: 恒定项，体现论文明确确认的规律：
  1) 电压随电流增大而增大；随温度升高而降低；
  2) 低 GH 温度 + 低 cell 温度容易发生沉淀/压升风险（Safe-Guard 中强惩罚）。
- H_objective: 可变项，模板改变对 FE/SPC/Voltage/Risk 的偏好（权重注入）。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np
from kaiwu.core import BinaryModel, Binary, quicksum

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class VarConfig:
    """单个物理变量的编码配置（定点二进制编码）。"""

    min_val: float
    max_val: float
    bits: int
    unit: str

    @property
    def step(self) -> float:
        return (self.max_val - self.min_val) / (2**self.bits - 1)


class QuantumCore:
    """
    QUBO 量子核心：
    - 固定变量拓扑（bit 分配不变）
    - 通过模板/权重注入动态重塑 Q 矩阵
    """

    def __init__(self, bits_override: Optional[Dict[str, int]] = None) -> None:
        # 论文 Table 1 给出的训练参数空间（我们默认按此范围，以保证“学术可信”）
        # https://doi.org/10.1021/acsenergylett.5c01133
        base_config: Dict[str, VarConfig] = {
            # current density / mA cm^-2
            "current_density": VarConfig(min_val=300.0, max_val=400.0, bits=5, unit="mA/cm2"),
            # cell temperature / °C
            "temperature": VarConfig(min_val=60.0, max_val=70.0, bits=5, unit="°C"),
            # gas humidifier (GH) temperature / °C
            "gh_temperature": VarConfig(min_val=55.0, max_val=65.0, bits=5, unit="°C"),
            # CO2 feed flow rate / (cm3 min^-1 cm^-2)
            # 论文 Table 1 给出范围 9.375~12.5
            "co2_flow": VarConfig(min_val=9.375, max_val=12.5, bits=5, unit="cm3/min/cm2"),
            # anolyte electrical conductivity (EC)
            # 论文将 EC 作为输入特征，但正文未给出明确设定点；此处采用归一化“可调特征”
            # 生产可直接替换为费曼动力数据字段（例如电导率/浓度/电解液组成的等效指标）。
            "anolyte_ec": VarConfig(min_val=0.8, max_val=1.2, bits=5, unit="norm"),
        }

        # 允许调用方覆盖每个变量的 bit 数（用于展示规模扩大/分辨率提升）
        # 注意：这会改变 QUBO 的变量数量（n），从而影响经典求解难度与运行时间。
        if bits_override:
            overridden: Dict[str, VarConfig] = {}
            for name, cfg in base_config.items():
                b = bits_override.get(name, cfg.bits)
                try:
                    b_int = int(b)
                except Exception:
                    b_int = cfg.bits
                # 基础保护：bit 至少为 1，且不要太离谱（CLI 可允许更大）
                if b_int < 1:
                    b_int = 1
                overridden[name] = VarConfig(min_val=cfg.min_val, max_val=cfg.max_val, bits=b_int, unit=cfg.unit)
            self.variables_config = overridden
        else:
            self.variables_config = base_config

        # 模板权重（动态项），可被 Weight-Modifier Agent 注入覆盖
        # 解释：
        # - w_fe: FE(CO) 奖励（越大越倾向最大 CO 选择性）
        # - w_spc: SPC 奖励（越大越倾向高单程转化）
        # - w_volt: Voltage 惩罚（越大越倾向低能耗/低电压）
        # - w_risk: 风险惩罚（越大越倾向远离“低GH+低T”的沉淀/压升区域）
        self.templates: Dict[str, Dict[str, float]] = {
            "balanced": {"w_fe": 1.0, "w_spc": 1.0, "w_volt": 1.0, "w_risk": 1.0},
            # Max-Yield (论文里 FE(CO) 90-100%，该模式更愿意牺牲电压以换取选择性/产率)
            "precision": {"w_fe": 6.0, "w_spc": 2.0, "w_volt": 0.5, "w_risk": 1.0},
            # Eco-Mode (极低能耗): 强惩罚电压，弱化 FE/SPC
            "speed": {"w_fe": 0.5, "w_spc": 0.5, "w_volt": 6.0, "w_risk": 1.0},
            # Safe-Guard (设备保护/寿命优先): 风险权重极高
            "safe": {"w_fe": 1.0, "w_spc": 1.0, "w_volt": 1.0, "w_risk": 10.0},
        }

        total_bits = sum(cfg.bits for cfg in self.variables_config.values())
        logger.info("QuantumCore Initialized with %d variables, total_bits=%d.", len(self.variables_config), total_bits)

    # -------------------------
    # Encoding / Decoding
    # -------------------------
    def _decode_bits(self, bits_msb_to_lsb: str, cfg: VarConfig) -> float:
        decimal_val = int(bits_msb_to_lsb, 2)
        return cfg.min_val + decimal_val * cfg.step

    def _build_linear_expr(self, bits: List, cfg: VarConfig):
        # x = min + step * Σ 2^i * b_i, i=0 is LSB
        return quicksum([bits[i] * (cfg.step * (2**i)) for i in range(len(bits))]) + cfg.min_val

    # -------------------------
    # Physics-inspired predictors (for output / KPI)
    # -------------------------
    def _predict_voltage(self, j: float, t_cell: float, ec: float) -> float:
        """
        论文趋势：
        - V 随电流增大而增大
        - V 与 cell temperature 成反比（温度越高电压越低）

        这里用“过电势常数 + 欧姆项”的简化形式，保证趋势一致并落在论文量级区间(≈2.8~3.3V)：
        V = V0 + (j/1000)*R(t,ec)
        """
        j_a = max(j, 1.0) / 1000.0  # A/cm2
        # R 随温度升高降低，随电导升高降低
        # 取线性近似，保证正值
        r = 2.2 - 0.05 * (t_cell - 60.0) - 0.8 * (ec - 1.0)
        r = float(np.clip(r, 1.0, 3.5))
        # 参考论文给出的电压量级（约 2.8–3.3 V），这里取略高基线以匹配区间
        v0 = 2.35
        return float(v0 + j_a * r)

    def _predict_fe_co(self, j: float, t_cell: float, t_gh: float, ec: float) -> float:
        """
        论文观察：
        - FE(CO) 在 90-100% 波动
        - 低 GH 温度更偏向 CO 形成（CO/H2 比更高）=> 可视为 FE(CO) 更高

        这里构建一个可解释的“近似 FE”：
        FE = 95 + Δ_GH + Δ_j + Δ_T + Δ_EC, 并夹紧在 [90, 100]
        """
        # GH 越低，CO 选择性越高（55->+5, 65->0）
        delta_gh = (65.0 - t_gh) * 0.5
        # 电流密度偏离中点(350)会轻微降低选择性（幅度很小）
        delta_j = -0.0005 * (j - 350.0) ** 2
        # 温度更高略增（幅度很小）
        delta_t = 0.08 * (t_cell - 65.0)
        # 电导更高略增（间接反映更稳定电解环境）
        delta_ec = 2.0 * (ec - 1.0)
        fe = 95.0 + delta_gh + delta_j + delta_t + delta_ec
        return float(np.clip(fe, 90.0, 100.0))

    def _predict_spc(self, j: float, co2_flow: float) -> float:
        """
        论文量级：SPC ≈ 15~35%
        趋势（合理近似）：
        - j ↑ => 转化倾向 ↑
        - CO2 flow ↑ => 单程转化（利用率）↓
        """
        # 基线
        spc = 20.0
        spc += 0.15 * (j - 300.0)  # 300->0, 400->+15
        spc -= 4.0 * (co2_flow - 9.375)  # 9.375->0, 12.5->-12.5
        return float(np.clip(spc, 0.0, 100.0))

    # -------------------------
    # QUBO build / solve
    # -------------------------
    def build_and_solve_qubo(
        self,
        template_name: str = "balanced",
        weights_override: Optional[Dict[str, float]] = None,
        return_qubo: bool = False,
        solver_shots: int = 500,
        random_restarts: int = 1,
    ) -> Dict:
        """
        构建并求解 QUBO。
        - template_name: balanced/precision/speed/safe
        - weights_override: Weight-Modifier Agent 可注入的权重（只改权重，不改bit拓扑）
        - return_qubo: 是否返回 Q 矩阵与变量映射（用于前端热力图/解释）
        """
        base_w = self.templates.get(template_name, self.templates["balanced"])
        weights = dict(base_w)
        if weights_override:
            for k, v in weights_override.items():
                if k in weights and v is not None:
                    weights[k] = float(v)

        logger.info("Building QUBO template=%s weights=%s", template_name, weights)

        # --------
        # Static topology: define bits (do not change across templates)
        # --------
        bit_vars: Dict[str, List] = {}
        expr_vars: Dict[str, object] = {}

        for var_name, cfg in self.variables_config.items():
            bits = [Binary(f"{var_name}_{i}") for i in range(cfg.bits)]
            bit_vars[var_name] = bits
            expr_vars[var_name] = self._build_linear_expr(bits, cfg)

        j = expr_vars["current_density"]
        t_cell = expr_vars["temperature"]
        t_gh = expr_vars["gh_temperature"]
        f_in = expr_vars["co2_flow"]
        ec = expr_vars["anolyte_ec"]

        # --------
        # Build physics + objective (quadratic in these linear-encoded variables)
        # --------
        # 参考点（论文 Table 1 的中点）
        j_ref = 350.0
        t_ref = 65.0
        gh_ref = 60.0
        f_ref = 11.0
        ec_ref = 1.0

        dj = (j - j_ref)
        dt = (t_cell - t_ref)
        dgh = (t_gh - gh_ref)
        df = (f_in - f_ref)
        dec = (ec - ec_ref)

        # ---- H_physics: 论文确认的物理趋势 + 风险机制（不随模板改变结构，只改变权重）
        # Voltage physics proxy: V ↑ with j, V ↓ with T, V ↓ with EC
        # 将电阻近似为 R = r0 - rT*dt - rEC*dec，使得 V_ohm = (j/1000)*R -> 产生 -j*T 与 -j*EC 的耦合项
        r0 = 2.2
        rT = 0.02
        rEC = 0.8
        v_phys = (j / 1000.0) * (r0 - rT * dt - rEC * dec)

        # Risk proxy (precipitate/pressure increase): low GH + low cell T is risky (论文描述)
        # 用“逼近高安全值”的二次惩罚：T 趋向 70，GH 趋向 65
        t_safe = 70.0
        gh_safe = 65.0
        h_risk = (t_cell - t_safe) * (t_cell - t_safe) + (t_gh - gh_safe) * (t_gh - gh_safe)

        # ---- H_objective: FE / SPC / Voltage 的模板化偏好
        # FE proxy: GH 越低越偏向 CO（奖励），j 偏离 350 会略降（惩罚），温度略奖励
        fe_proxy = (
            -0.0005 * dj * dj
            -0.5 * dgh   # GH 越低(dgh为负) => fe_proxy 越大（奖励）
            +0.08 * dt
            +2.0 * dec
        )

        # SPC proxy: j↑ => SPC↑, flow↑ => SPC↓
        spc_proxy = (0.15 * (j - 300.0) - 4.0 * (f_in - 9.375))

        # Voltage objective proxy: 惩罚 v_phys，并额外惩罚高电流（寿命/能耗）
        volt_proxy = v_phys + 0.00002 * dj * dj

        # 归一化（避免量纲差导致某项碾压）
        # 经验：dj^2 最大约 2500；t/gh 偏差最大约 5；df 最大约 1.5；dec 最大约 0.2
        norm_volt = 1.0
        norm_fe = 1.0
        norm_spc = 1.0 / 100.0
        norm_risk = 1.0 / 100.0

        # 总能量（最小化）
        # E = w_volt*V - w_fe*FE - w_spc*SPC + w_risk*Risk
        total_energy = (
            weights["w_volt"] * norm_volt * volt_proxy
            - weights["w_fe"] * norm_fe * fe_proxy
            - weights["w_spc"] * norm_spc * spc_proxy
            + weights["w_risk"] * norm_risk * h_risk
        )

        model = BinaryModel()
        model.set_objective(total_energy)

        # 提取 QUBO matrix
        qubo_mat, var_map = self._model_to_matrix(model)

        # 求解：默认使用本地 fallback（避免 Kaiwu SA 的 license 交互式提示）
        # 为了让“经典求解”在更大规模下耗时更明显，这里支持 solver_shots / random_restarts 调参。
        try:
            solver_shots = int(solver_shots)
        except Exception:
            solver_shots = 500
        solver_shots = max(1, solver_shots)

        try:
            random_restarts = int(random_restarts)
        except Exception:
            random_restarts = 1
        random_restarts = max(1, random_restarts)

        best_sol_vec = None
        best_energy = float("inf")
        for _ in range(random_restarts):
            sol = self._fallback_solver(qubo_mat, len(var_map), shots=solver_shots)
            e = float(sol.T @ qubo_mat @ sol)
            if e < best_energy:
                best_energy = e
                best_sol_vec = sol

        sol_vec = best_sol_vec

        # 解析 bits -> 物理量
        sol_dict = self._vector_to_solution_dict(sol_vec, var_map)

        decoded_params: Dict[str, float] = {}
        for var_name, cfg in self.variables_config.items():
            bits_str = self._extract_bits_from_solution(sol_dict, var_name, cfg.bits)
            decoded_params[var_name] = self._decode_bits(bits_str, cfg)

        # 输出 KPI（用论文趋势一致的 surrogate）
        j_val = decoded_params["current_density"]
        t_val = decoded_params["temperature"]
        gh_val = decoded_params["gh_temperature"]
        f_val = decoded_params["co2_flow"]
        ec_val = decoded_params["anolyte_ec"]

        voltage = self._predict_voltage(j_val, t_val, ec_val)
        fe = self._predict_fe_co(j_val, t_val, gh_val, ec_val)
        spc = self._predict_spc(j_val, f_val)

        # 风险指示：低 GH + 低 T 区域（论文描述的 precipitate/pressure-increase 区域）
        risk_flag = bool((gh_val <= 58.0) and (t_val <= 62.5))

        result: Dict = {
            "parameters": {
                "current_density": round(j_val, 3),
                "temperature": round(t_val, 3),      # cell temperature
                "gh_temperature": round(gh_val, 3),  # GH temperature
                "co2_flow": round(f_val, 3),
                "anolyte_ec": round(ec_val, 4),
            },
            "metrics": {
                "fe_score": round(fe, 2),  # FE(CO) %
                "voltage": round(voltage, 3),
                "spc": round(spc, 2),      # %
                "risk_precipitation": risk_flag,
            },
            "qubo_stats": {
                "energy": round(float(best_energy), 6),
                "total_bits": int(sum(cfg.bits for cfg in self.variables_config.values())),
                "solver_shots": int(solver_shots),
                "random_restarts": int(random_restarts),
            },
            "template": template_name,
            "weights": weights,
        }

        if return_qubo:
            result["qubo"] = {
                "matrix": qubo_mat.tolist(),
                "var_index": var_map,
            }

        return result

    # -------------------------
    # QUBO helpers
    # -------------------------
    def _model_to_matrix(self, model: BinaryModel) -> Tuple[np.ndarray, Dict[str, int]]:
        coeff_dict = model.objective.coefficient

        # Kaiwu Binary('x') 会生成变量名类似 'bx'，所以这里按实际命名规则补 'b'
        known_vars: List[str] = []
        for var_name, cfg in self.variables_config.items():
            for i in range(cfg.bits):
                known_vars.append(f"b{var_name}_{i}")

        known_vars = sorted(known_vars)
        var_map = {v: i for i, v in enumerate(known_vars)}
        mat = np.zeros((len(known_vars), len(known_vars)))

        for key, val in coeff_dict.items():
            if len(key) == 1:
                i = var_map.get(key[0])
                if i is not None:
                    mat[i, i] += float(val)
            elif len(key) == 2:
                i = var_map.get(key[0])
                j = var_map.get(key[1])
                if i is not None and j is not None:
                    if i > j:
                        i, j = j, i
                    mat[i, j] += float(val)

        return mat, var_map

    def _fallback_solver(self, qubo_mat: np.ndarray, n_vars: int, shots: int = 500) -> np.ndarray:
        """
        本地模拟退火（避免 Kaiwu license 交互）。
        目标：min x^T Q x, x∈{0,1}^n
        """
        rng = np.random.default_rng()
        x = rng.integers(0, 2, size=n_vars, dtype=int)

        def energy(v):
            return float(v.T @ qubo_mat @ v)

        e = energy(x)
        best_x = x.copy()
        best_e = e

        T = 5.0
        cooling = 0.98

        for _ in range(shots):
            i = int(rng.integers(0, n_vars))
            x2 = x.copy()
            x2[i] = 1 - x2[i]
            e2 = energy(x2)
            d = e2 - e
            if d <= 0 or rng.random() < np.exp(-d / max(T, 1e-6)):
                x = x2
                e = e2
                if e < best_e:
                    best_e = e
                    best_x = x.copy()
            T *= cooling

        return best_x.astype(float)

    def _vector_to_solution_dict(self, sol_vec: np.ndarray, var_map: Dict[str, int]) -> Dict[str, int]:
        idx_to_name = {idx: name for name, idx in var_map.items()}
        return {idx_to_name[i]: int(sol_vec[i]) for i in range(len(sol_vec))}

    def _extract_bits_from_solution(self, sol_dict: Dict[str, int], var_prefix: str, bits: int) -> str:
        # bits are stored as b{var}_{i} where i is LSB index in our encoding
        b = []
        for i in range(bits):
            key = f"b{var_prefix}_{i}"
            b.append("1" if sol_dict.get(key, 0) else "0")
        # return MSB->LSB
        return "".join(reversed(b))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    core = QuantumCore()
    for tpl in ["balanced", "precision", "speed", "safe"]:
        out = core.build_and_solve_qubo(template_name=tpl)
        print(tpl, out["parameters"], out["metrics"])
