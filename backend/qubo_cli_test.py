#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QuantumSentry - QUBO 交互测试脚本

用途：
- 选择模板（balanced/precision/speed/safe）
- 可选注入权重（w_fe / w_spc / w_volt / w_risk）
- 运行一次 QUBO 寻优并打印结果
- 可选输入“手动工况参数”，计算该工况对应的 QUBO 能量 E(x)=x^T Q x，并输出 KPI 预测

运行方式（推荐 python3.10）：
  /opt/homebrew/bin/python3.10 backend/qubo_cli_test.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Dict, Optional, Tuple


def _ensure_repo_root_on_path() -> None:
    """确保可以 import backend.quantum_core（把项目根目录加入 sys.path）。"""
    this_file = Path(__file__).resolve()
    repo_root = this_file.parents[1]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))


def _warn_python_version() -> None:
    major, minor = sys.version_info[:2]
    if (major, minor) != (3, 10):
        print(
            f"[警告] 当前 Python 版本为 {major}.{minor}，Kaiwu SDK 的本地 so 通常要求 Python 3.10。"
            f"\n      建议使用：/opt/homebrew/bin/python3.10 backend/qubo_cli_test.py\n"
        )


def _ask(prompt: str, default: Optional[str] = None) -> str:
    suffix = f"（默认 {default}）" if default is not None else ""
    while True:
        s = input(f"{prompt}{suffix}: ").strip()
        if s:
            return s
        if default is not None:
            return default


def _ask_yes_no(prompt: str, default: bool = False) -> bool:
    d = "y" if default else "n"
    while True:
        s = input(f"{prompt} [y/n]（默认 {d}）: ").strip().lower()
        if not s:
            return default
        if s in ("y", "yes"):
            return True
        if s in ("n", "no"):
            return False


def _ask_float(prompt: str, default: Optional[float] = None, min_val: Optional[float] = None, max_val: Optional[float] = None) -> float:
    d = f"{default}" if default is not None else None
    while True:
        raw = _ask(prompt, default=d)
        try:
            val = float(raw)
        except ValueError:
            print("  请输入合法数字。")
            continue
        if min_val is not None and val < min_val:
            print(f"  输入过小，需 ≥ {min_val}")
            continue
        if max_val is not None and val > max_val:
            print(f"  输入过大，需 ≤ {max_val}")
            continue
        return val


def _ask_int(prompt: str, default: Optional[int] = None, min_val: Optional[int] = None, max_val: Optional[int] = None) -> int:
    d = f"{default}" if default is not None else None
    while True:
        raw = _ask(prompt, default=d)
        try:
            val = int(raw)
        except ValueError:
            print("  请输入合法整数。")
            continue
        if min_val is not None and val < min_val:
            print(f"  输入过小，需 ≥ {min_val}")
            continue
        if max_val is not None and val > max_val:
            print(f"  输入过大，需 ≤ {max_val}")
            continue
        return val


def _print_classical_bruteforce_estimate(total_bits: int) -> None:
    """
    打印“经典穷举”复杂度估计，用于演示指数爆炸。
    注意：这是 exact brute-force baseline，不代表所有经典启发式算法都要穷举。
    """
    if total_bits <= 0:
        return

    log10_states = total_bits * math.log10(2.0)
    print(f"\n总量子比特数（QUBO 二进制变量数）n = {total_bits}")
    print(f"搜索空间大小：2^{total_bits} ≈ 10^{log10_states:.2f}")

    # 让用户输入一个“每秒评估状态数”的假设，用于估算（给一个非常乐观的默认值）
    rate = _ask_float("假设经典 exact 穷举速度（states/s，用于估算）", default=1e9, min_val=1e3)
    log10_seconds = log10_states - math.log10(rate)

    # years = seconds / (365*24*3600)
    log10_years = log10_seconds - math.log10(365.0 * 24.0 * 3600.0)
    print(f"若按 {rate:.3g} states/s 做 exact 穷举，预计耗时约：10^{log10_years:.2f} 年")


def _normalize_template(s: str) -> str:
    s0 = s.strip().lower()
    alias = {
        "balanced": "balanced",
        "balance": "balanced",
        "平衡": "balanced",
        "precision": "precision",
        "max-yield": "precision",
        "max_yield": "precision",
        "产率": "precision",
        "极限产率": "precision",
        "speed": "speed",
        "eco": "speed",
        "eco-mode": "speed",
        "经济": "speed",
        "经济运行": "speed",
        "safe": "safe",
        "safe-guard": "safe",
        "safeguard": "safe",
        "保护": "safe",
        "设备保护": "safe",
    }
    return alias.get(s0, s0)


def _ask_weights_override() -> Optional[Dict[str, float]]:
    print("\n可选：注入权重（直接回车表示不覆盖该项）")
    print("  - w_fe   : FE(CO) 奖励权重（越大越偏向高 FE）")
    print("  - w_spc  : SPC 奖励权重（越大越偏向高 SPC）")
    print("  - w_volt : Voltage 惩罚权重（越大越偏向低电压/低能耗）")
    print("  - w_risk : 风险惩罚权重（越大越远离低GH+低T风险区）\n")

    out: Dict[str, float] = {}
    for k in ("w_fe", "w_spc", "w_volt", "w_risk"):
        raw = input(f"{k} = ").strip()
        if not raw:
            continue
        try:
            out[k] = float(raw)
        except ValueError:
            print(f"  跳过 {k}：输入不是数字。")
    return out or None


def _encode_value_to_bits(value: float, cfg) -> Tuple[int, str]:
    """
    把物理值编码为整数与 bit 串（MSB->LSB）。
    cfg 需包含 min_val/max_val/bits/step。
    """
    v = max(cfg.min_val, min(cfg.max_val, float(value)))
    k = int(round((v - cfg.min_val) / cfg.step))
    k = max(0, min((2**cfg.bits - 1), k))
    bit_str = format(k, f"0{cfg.bits}b")
    return k, bit_str


def _energy_from_qubo(Q, x) -> float:
    # Q 为上三角或任意矩阵均可；能量计算用 x^T Q x
    import numpy as np

    xv = np.asarray(x, dtype=float)
    Qm = np.asarray(Q, dtype=float)
    return float(xv.T @ Qm @ xv)


def main() -> None:
    _warn_python_version()
    _ensure_repo_root_on_path()

    try:
        from backend.quantum_core import QuantumCore
    except Exception as e:
        print("[错误] 无法导入 QuantumCore。常见原因：未使用 Python3.10 或 kaiwu so 加载失败。")
        print("异常信息：", str(e))
        sys.exit(1)

    # 先用默认位宽创建一个 core，用于展示变量列表和默认 bits
    base_core = QuantumCore()

    # 允许用户自由分配每个参数的量子比特数（用于演示规模扩大、经典穷举指数爆炸）
    bits_override: Optional[Dict[str, int]] = None
    if _ask_yes_no("是否自定义每个参数的量子比特数（bits）？", default=True):
        print("\n请输入每个参数的 bits（建议 5~20；越大 QUBO 规模越大，2^n 爆炸越明显）")
        print("直接回车使用默认 bits。\n")
        bits_override = {}
        for name, cfg in base_core.variables_config.items():
            b = _ask_int(f"{name} bits", default=cfg.bits, min_val=1, max_val=30)
            bits_override[name] = b

    core = QuantumCore(bits_override=bits_override) if bits_override else base_core

    print("\n=== QuantumSentry | QUBO 交互测试 ===")
    print("当前变量拓扑（固定 bit 分配）：")
    for name, cfg in core.variables_config.items():
        print(f"  - {name}: [{cfg.min_val}, {cfg.max_val}] {cfg.unit}, bits={cfg.bits}, step≈{cfg.step:.6g}")

    # 展示规模（用于对比经典穷举）
    total_bits = sum(cfg.bits for cfg in core.variables_config.values())
    if _ask_yes_no("是否打印“经典穷举”复杂度估计（用于展示指数爆炸）？", default=True):
        _print_classical_bruteforce_estimate(total_bits)

    # 模拟“为了在更大空间找到最优解，经典算法所需的迭代次数必须指数级增长”
    # 假设每增加 1 bit，空间翻倍，为了维持相同的“覆盖率”，shots 应该翻倍？
    # 实际上 SA 不需要遍历所有，但通常需要 exp(n^k) 或至少多项式增长。
    # 为了演示效果，我们设定 base=1.15 的指数增长。
    # 系数调整：5000 以确保在 n=50 时有明显停顿 (约数秒)，n=80 时进入分钟级。
    scale_factor = 1.15
    suggested_shots = int(5000 * (scale_factor ** total_bits))

    print("\n可选：设置本地求解预算（shots）")
    print(f"  说明：为了在 2^{total_bits} 的空间中找到最优解，经典算法(SA)的迭代次数通常需要随规模指数增长。")
    print(f"  推荐 shots ≈ {suggested_shots:,} (基于 1.15^n 估算)")

    default_shots = suggested_shots
    solver_shots = _ask_int("模拟退火迭代次数 shots", default=default_shots, min_val=1, max_val=1_000_000_000)
    random_restarts = _ask_int("随机重启次数 restarts", default=1, min_val=1, max_val=200)

    print("\n可用模板：balanced（平衡） / precision（极限产率） / speed（经济运行） / safe（设备保护）")
    tpl_in = _ask("请选择模板 template", default="balanced")
    template = _normalize_template(tpl_in)
    if template not in core.templates:
        print(f"[提示] 未知模板 '{template}'，将使用 balanced。")
        template = "balanced"

    weights_override = _ask_weights_override() if _ask_yes_no("是否覆盖权重？", default=False) else None
    want_qubo = _ask_yes_no("是否返回并保存 QUBO 矩阵（用于热力图/调试）？", default=False)

    print("\n>>> 开始运行 QUBO 寻优 ...")
    result = core.build_and_solve_qubo(
        template_name=template,
        weights_override=weights_override,
        return_qubo=want_qubo,
        solver_shots=solver_shots,
        random_restarts=random_restarts,
    )

    params = result["parameters"]
    metrics = result["metrics"]
    weights = result.get("weights", {})

    print("\n=== 寻优结果 ===")
    print(f"模板: {result.get('template')}")
    print("权重:", weights)
    print("\n推荐工况参数（解码后的最优值）：")
    print(f"  - current_density : {params['current_density']} mA/cm2")
    print(f"  - temperature     : {params['temperature']} °C")
    print(f"  - gh_temperature  : {params['gh_temperature']} °C")
    print(f"  - co2_flow        : {params['co2_flow']} cm3/min/cm2")
    print(f"  - anolyte_ec      : {params['anolyte_ec']} (norm)")

    print("\nKPI 预测：")
    print(f"  - FE(CO)          : {metrics['fe_score']} %")
    print(f"  - Voltage         : {metrics['voltage']} V")
    print(f"  - SPC             : {metrics['spc']} %")
    print(f"  - Risk(precip.)   : {metrics['risk_precipitation']}")

    if want_qubo:
        save = _ask_yes_no("是否把 QUBO 矩阵保存到 JSON 文件？", default=True)
        if save:
            out_path = _ask("输出文件路径", default=f"backend/qubo_{template}.json")
            payload = {
                "template": template,
                "weights": weights,
                "variables_config": {
                    k: {"min": v.min_val, "max": v.max_val, "bits": v.bits, "unit": v.unit, "step": v.step}
                    for k, v in core.variables_config.items()
                },
                "qubo": result["qubo"],
            }
            Path(out_path).parent.mkdir(parents=True, exist_ok=True)
            Path(out_path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"[已保存] {out_path}")

    # -----------------------
    # 手动评估：给定工况 -> 计算能量 & KPI
    # -----------------------
    if _ask_yes_no("\n是否进入“手动工况评估”模式？（输入一组参数，计算其 QUBO 能量）", default=True):
        # 如果刚才没返回 qubo，这里再构建一次（同模板/权重），用于评估能量
        if not want_qubo:
            tmp = core.build_and_solve_qubo(
                template_name=template,
                weights_override=weights_override,
                return_qubo=True,
                # 这里只是为了拿 Q 矩阵，没必要再跑很久
                solver_shots=1,
                random_restarts=1,
            )
            qubo = tmp["qubo"]
        else:
            qubo = result["qubo"]

        Q = qubo["matrix"]
        var_index: Dict[str, int] = qubo["var_index"]

        print("\n进入评估循环：输入一组工况 -> 输出能量与 KPI。输入 'q' 退出。\n")

        while True:
            s = input("继续评估？回车继续 / 输入 q 退出: ").strip().lower()
            if s == "q":
                break

            manual_params: Dict[str, float] = {}
            encoded_info: Dict[str, Dict[str, object]] = {}

            for name, cfg in core.variables_config.items():
                raw = input(f"{name}（范围 {cfg.min_val}~{cfg.max_val} {cfg.unit}，回车用推荐值 {params.get(name)}）: ").strip()
                if not raw:
                    manual_params[name] = float(params.get(name))
                else:
                    manual_params[name] = float(raw)

                k, bit_str = _encode_value_to_bits(manual_params[name], cfg)
                encoded_info[name] = {"int": k, "bits": bit_str}

            # 构建 x 向量（按 var_index）
            n = len(var_index)
            x = [0] * n
            for name, cfg in core.variables_config.items():
                # bit_str 是 MSB->LSB；我们需要按 i=0..bits-1 (LSB) 填入 b{name}_{i}
                k = int(encoded_info[name]["int"])
                for i in range(cfg.bits):
                    bit = (k >> i) & 1
                    key = f"b{name}_{i}"
                    idx = var_index.get(key)
                    if idx is not None:
                        x[idx] = bit

            E = _energy_from_qubo(Q, x)

            # KPI 预测（用 core 的 surrogate）
            j = manual_params["current_density"]
            t = manual_params["temperature"]
            gh = manual_params["gh_temperature"]
            f = manual_params["co2_flow"]
            ec = manual_params["anolyte_ec"]

            voltage = core._predict_voltage(j, t, ec)     # noqa: SLF001
            fe = core._predict_fe_co(j, t, gh, ec)        # noqa: SLF001
            spc = core._predict_spc(j, f)                 # noqa: SLF001

            risk_flag = bool((gh <= 58.0) and (t <= 62.5))

            print("\n--- 编码结果（MSB->LSB）---")
            for name in core.variables_config.keys():
                info = encoded_info[name]
                print(f"  {name}: int={info['int']} bits={info['bits']}")

            print("\n--- QUBO 能量与 KPI ---")
            print(f"  E(x)=x^TQx : {E:.6g}")
            print(f"  FE(CO)     : {fe:.2f} %")
            print(f"  Voltage    : {voltage:.3f} V")
            print(f"  SPC        : {spc:.2f} %")
            print(f"  Risk       : {risk_flag}\n")

    print("\n完成。")


if __name__ == "__main__":
    main()


