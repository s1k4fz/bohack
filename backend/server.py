import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from quantum_core import QuantumCore
import time

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

@app.route('/api/optimize', methods=['POST'])
def run_optimization():
    """
    启动 QUBO 优化任务
    Input: {
        "task_id": "T-xxxx",
        "template": "balanced" | "precision" | "speed",
        "params": { ... } (Optional overrides)
    }
    """
    data = request.json or {}
    task_id = data.get('task_id', 'unknown')
    template = data.get('template', 'balanced')
    
    logger.info(f"Received optimization task {task_id} with template {template}")
    
    # 根据模板调整权重 (Demonstration)
    alpha = 1.0
    beta = 5.0
    
    if template == 'precision':
        # 精度优先：更看重 FE (alpha up), 允许更多迭代
        alpha = 2.0
    elif template == 'speed':
        # 速度优先：可能减少迭代或降低精度 (not impl in core yet)
        pass
    
    try:
        start_time = time.time()
        
        # 调用核心求解
        result = core.build_and_solve_qubo(alpha=alpha, beta=beta)
        
        elapsed = time.time() - start_time
        
        response = {
            "task_id": task_id,
            "status": "success",
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
    app.run(host='0.0.0.0', port=5001, debug=True)

