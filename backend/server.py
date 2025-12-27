import logging
import sys
import time
import math
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS

# 关键修复：当以 `python backend/server.py` 运行时，sys.path[0] 是 backend/，
# 根目录不会自动加入 sys.path，导致 `import kaiwu` 失败。
# 这里强制把项目根目录加入 sys.path，以便 backend/quantum_core.py 能导入 kaiwu 包。
_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from quantum_core import QuantumCore

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('QuantumServer')

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 初始化量子核心
core = QuantumCore()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "QuantumSentry Core"}), 200

def _safe_float(x, default=None):
    try:
        if x is None:
            return default
        return float(x)
    except Exception:
        return default

def _safe_str(x, default=""):
    try:
        s = str(x).strip()
        return s if s else default
    except Exception:
        return default

def _normalize_template(template: str) -> str:
    """
    统一模板命名：balanced / precision / speed / safe
    """
    s0 = (template or "balanced").strip().lower()
    alias = {
        "balanced": "balanced",
        "balance": "balanced",
        "平衡": "balanced",
        "precision": "precision",
        "max-yield": "precision",
        "max_yield": "precision",
        "maxyield": "precision",
        "产率": "precision",
        "高产率": "precision",
        "精度": "precision",
        "speed": "speed",
        "eco": "speed",
        "eco-mode": "speed",
        "eco_mode": "speed",
        "低能耗": "speed",
        "速度": "speed",
        "safe": "safe",
        "safe-guard": "safe",
        "safe_guard": "safe",
        "safeguard": "safe",
        "安全": "safe",
        "保护": "safe",
    }
    return alias.get(s0, s0)

def _weights_from_payload(raw) -> dict | None:
    """
    支持两种输入格式：
    1) {w_fe,w_spc,w_volt,w_risk}
    2) {alpha,beta,gamma,constraintPenalty}（会做一个粗映射）
    """
    if not isinstance(raw, dict):
        return None

    # 直接命中后端权重字段
    keys = {"w_fe", "w_spc", "w_volt", "w_risk"}
    if any(k in raw for k in keys):
        out = {}
        for k in ("w_fe", "w_spc", "w_volt", "w_risk"):
            if k in raw:
                v = _safe_float(raw.get(k), None)
                if v is not None:
                    out[k] = v
        return out or None

    # 兼容 alpha/beta/gamma 的粗映射（不追求学术严格，仅做可用桥接）
    alpha = _safe_float(raw.get("alpha"), None)
    beta = _safe_float(raw.get("beta"), None)
    gamma = _safe_float(raw.get("gamma"), None)
    if alpha is None and beta is None and gamma is None:
        return None

    out = {
        "w_fe": float(alpha) if alpha is not None else 1.0,
        "w_volt": float(beta) if beta is not None else 1.0,
        "w_risk": float(gamma) if gamma is not None else 1.0,
        "w_spc": 1.0,
    }
    return out

@app.route('/api/predict', methods=['POST'])
def predict_metrics():
    """
    参数预测（真实后端 QUBO/物理代理逻辑）：
    - forward: 给定工况 -> 预测 FE / Voltage / SPC（使用 quantum_core.py 的 surrogate）
    - reverse: 给定目标 FE/Voltage -> 通过“多模板 QUBO 寻优 + 目标匹配”推荐工况

    Input:
      {
        "mode": "forward" | "reverse",
        "template": "balanced" | "precision" | "speed" | "safe" | "auto",
        "weights": { ... },  // optional: w_fe/w_spc/w_volt/w_risk 或 alpha/beta/gamma
        "inputs": {
          "currentDensity": number, // mA/cm²
          "temperature": number,    // °C
          "co2Flow": number,        // sccm（我们按 electrode_area_cm2 折算到论文的 cm3/min/cm2）
          "ghTemperature": number,  // optional °C
          "anolyteEC": number       // optional norm
        },
        "targets": {
          "fe": number,
          "voltage": number
        },
        "options": {
          "electrode_area_cm2": number
        }
      }
    """
    data = request.json or {}
    mode = _safe_str(data.get("mode"), "forward").lower()
    template = _normalize_template(_safe_str(data.get("template"), "balanced"))

    weights_override = _weights_from_payload(data.get("weights")) or _weights_from_payload((data.get("params") or {}).get("weights"))  # 兼容旧字段

    options = data.get("options") or {}
    electrode_area_cm2 = _safe_float(options.get("electrode_area_cm2"), 4.0) or 4.0
    electrode_area_cm2 = max(0.1, float(electrode_area_cm2))

    try:
        start_time = time.time()

        if mode == "forward":
            inputs = data.get("inputs") or {}
            j = _safe_float(inputs.get("currentDensity"), 250.0) or 250.0
            t_cell = _safe_float(inputs.get("temperature"), 50.0) or 50.0
            co2_sccm = _safe_float(inputs.get("co2Flow"), 50.0) or 50.0
            t_gh = _safe_float(inputs.get("ghTemperature"), 60.0) or 60.0
            ec = _safe_float(inputs.get("anolyteEC"), 1.0) or 1.0

            # 论文变量 co2_flow 为 cm3/min/cm2，这里用 sccm/area 做一个近似折算
            co2_flow_norm = float(co2_sccm) / float(electrode_area_cm2)

            voltage = core._predict_voltage(j, t_cell, ec)
            fe = core._predict_fe_co(j, t_cell, t_gh, ec)
            spc = core._predict_spc(j, co2_flow_norm)
            risk_flag = bool((t_gh <= 58.0) and (t_cell <= 62.5))

            elapsed = time.time() - start_time
            return jsonify({
                "status": "success",
                "mode": "forward",
                "template": template,
                "duration_ms": round(elapsed * 1000, 2),
                "inputs": {
                    "currentDensity": j,
                    "temperature": t_cell,
                    "co2Flow": co2_sccm,
                    "ghTemperature": t_gh,
                    "anolyteEC": ec,
                    "electrode_area_cm2": electrode_area_cm2,
                    "co2_flow_norm": round(co2_flow_norm, 4),
                },
                "metrics": {
                    "fe": round(float(fe), 2),
                    "voltage": round(float(voltage), 3),
                    "spc": round(float(spc), 2),
                    "risk_precipitation": risk_flag,
                },
                "weights": weights_override or core.templates.get(template, core.templates["balanced"]),
            }), 200

        if mode == "reverse":
            targets = data.get("targets") or {}
            target_fe = _safe_float(targets.get("fe"), 90.0) or 90.0
            target_v = _safe_float(targets.get("voltage"), 2.1) or 2.1

            # 候选模板：若用户指定具体模板则只跑一个；否则自动从 4 个模板里选“最接近目标”的
            candidates = [template] if template in ("balanced", "precision", "speed", "safe") else ["balanced", "precision", "speed", "safe"]

            best = None
            best_score = float("inf")

            for tpl in candidates:
                out = core.build_and_solve_qubo(
                    template_name=tpl,
                    weights_override=weights_override,
                    return_qubo=False,
                    solver_shots=500,
                    random_restarts=1,
                )
                m = out.get("metrics") or {}
                fe = float(m.get("fe_score") or 0.0)
                volt = float(m.get("voltage") or 0.0)

                # 归一化误差
                fe_diff = abs(fe - target_fe) / max(target_fe, 1e-6)
                v_diff = abs(volt - target_v) / max(target_v, 1e-6)
                score = fe_diff + v_diff

                if score < best_score:
                    best_score = score
                    best = out

            if not best:
                return jsonify({"status": "failed", "error": "No candidate solution found."}), 500

            params = best.get("parameters") or {}
            m = best.get("metrics") or {}

            # 将论文 co2_flow (cm3/min/cm2) 近似还原为 sccm：乘以 electrode_area_cm2
            co2_flow_norm = float(params.get("co2_flow") or 0.0)
            co2_sccm = co2_flow_norm * float(electrode_area_cm2)

            elapsed = time.time() - start_time
            return jsonify({
                "status": "success",
                "mode": "reverse",
                "duration_ms": round(elapsed * 1000, 2),
                "target": {
                    "fe": target_fe,
                    "voltage": target_v,
                },
                "selected": {
                    "template": best.get("template"),
                    "score": round(best_score, 6),
                },
                "recommended": {
                    "currentDensity": float(params.get("current_density") or 0.0),
                    "temperature": float(params.get("temperature") or 0.0),
                    "co2Flow": round(co2_sccm, 2),
                    "ghTemperature": float(params.get("gh_temperature") or 0.0),
                    "anolyteEC": float(params.get("anolyte_ec") or 0.0),
                    "electrode_area_cm2": electrode_area_cm2,
                    "co2_flow_norm": round(co2_flow_norm, 4),
                },
                "achievable": {
                    "fe": float(m.get("fe_score") or 0.0),
                    "voltage": float(m.get("voltage") or 0.0),
                    "spc": float(m.get("spc") or 0.0),
                    "risk_precipitation": bool(m.get("risk_precipitation")),
                },
                "qubo_stats": best.get("qubo_stats"),
                "weights": best.get("weights"),
            }), 200

        return jsonify({"status": "failed", "error": f"Unsupported mode: {mode}"}), 400

    except Exception as e:
        logger.error(f"Predict failed: {e}", exc_info=True)
        return jsonify({"status": "failed", "error": str(e)}), 500

@app.route('/api/optimize', methods=['POST'])
def run_optimization():
    """
    启动 QUBO 优化任务
    Input: {
        "task_id": "T-xxxx",
        "template": "balanced" | "precision" | "speed" | "safe",
        "params": { ... } (Optional overrides)
    }
    """
    data = request.json or {}
    task_id = data.get('task_id', 'unknown')
    template = (data.get('template', 'balanced') or 'balanced').strip()
    params = data.get('params') or {}
    
    logger.info(f"Received optimization task {task_id} with template {template}")

    # 模板别名兼容（便于前端/文档统一叫法）
    template_alias = {
        # Eco-Mode
        'eco': 'speed',
        'eco-mode': 'speed',
        'eco_mode': 'speed',
        # Max-Yield
        'max-yield': 'precision',
        'max_yield': 'precision',
        'maxyield': 'precision',
        # Safe-Guard
        'safe-guard': 'safe',
        'safe_guard': 'safe',
        'safeguard': 'safe',
    }
    resolved_template = template_alias.get(template.lower(), template.lower())
    
    try:
        start_time = time.time()
        
        # 调用核心求解
        weights_override = None
        if isinstance(params, dict) and isinstance(params.get('weights'), dict):
            weights_override = params.get('weights')

        return_qubo = bool(isinstance(params, dict) and params.get('return_qubo'))

        result = core.build_and_solve_qubo(
            template_name=resolved_template,
            weights_override=weights_override,
            return_qubo=return_qubo,
        )
        
        elapsed = time.time() - start_time
        
        response = {
            "task_id": task_id,
            "status": "success",
            "template": resolved_template,
            "duration_ms": round(elapsed * 1000, 2),
            "result": result
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Optimization failed: {e}", exc_info=True)
        return jsonify({
            "task_id": task_id,
            "status": "failed",
            "error": str(e)
        }), 500

if __name__ == '__main__':
    # 开发模式运行
    # Port 5000 is often taken by macOS ControlCenter (AirPlay)
    import os
    port = int(os.environ.get("QUBO_PORT") or os.environ.get("PORT") or "5001")
    app.run(host='0.0.0.0', port=port, debug=True)

