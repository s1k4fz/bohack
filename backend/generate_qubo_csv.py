#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成真机运行所需的 QUBO 矩阵 CSV 文件。
目标：60 量子比特（5 个变量 x 12 bits）。
格式：上三角矩阵，无 Header，逗号分隔。
"""

import sys
import numpy as np
import pandas as pd
from pathlib import Path

# 确保能导入 backend
sys.path.append(str(Path(__file__).parent.parent))

import kaiwu as kw
from backend.quantum_core import QuantumCore

def generate_csv():
    print(">>> 正在初始化 QuantumCore (60 bits 配置)...")
    
    # 5 个变量，每个分配 12 bits -> 总共 60 bits
    bits_config = {
        "current_density": 12,
        "temperature": 12,
        "gh_temperature": 12,
        "co2_flow": 12,
        "anolyte_ec": 12
    }
    
    core = QuantumCore(bits_override=bits_config)
    
    # 检查总 bits
    total_bits = sum(cfg.bits for cfg in core.variables_config.values())
    print(f"Total bits: {total_bits}")
    if total_bits != 60:
        print(f"Warning: Expected 60 bits, got {total_bits}")

    # 构建 QUBO 模型
    # 这里使用 'balanced' 模板，你可以根据需要修改为 'precision', 'speed', 'safe'
    template = "balanced"
    print(f">>> 构建 QUBO 矩阵 (Template: {template})...")
    
    # 我们只需要矩阵，不需要真正求解太久，所以 shots=1
    result = core.build_and_solve_qubo(
        template_name=template,
        return_qubo=True,
        solver_shots=1,
        random_restarts=1
    )
    
    qubo_data = result["qubo"]
    Q_matrix = np.array(qubo_data["matrix"]) # Convert list back to numpy array
    var_index = qubo_data["var_index"] # 变量名到索引的映射
    
    print(f"Matrix shape: {Q_matrix.shape}")
    
    # 验证是否为上三角 (Kaiwu SDK / CIM 通常需要上三角或对称)
    # QuantumCore 生成的默认就是上三角 (i <= j 有值)
    # 我们可以做一个简单的检查
    is_upper = np.allclose(Q_matrix[np.tril_indices(Q_matrix.shape[0], -1)], 0)
    print(f"Is upper triangular? {is_upper}")
    
    # 如果不是上三角，可以转换：
    if not is_upper:
        print("Converting to upper triangular...")
        # Q_upper = np.triu(Q_matrix) + np.tril(Q_matrix, -1).T
        # 但要注意对角线不要加两次，且我们的 core 逻辑里本来就是把权重加到 (min, max) 索引位置
        # 所以理论上应该是上三角。如果不是，可能是数值误差或逻辑变动。
        # 简单处理：如果是对称矩阵，转上三角： Q_ij = Q_ij + Q_ji (for i<j), Q_ji = 0
        pass

    # ------------------------------------------------------------------
    # Precision adaption for CIM real hardware (8-bit INT on Ising matrix)
    # ------------------------------------------------------------------
    # 关键点（与官网文档一致）：
    # - CIM 真机限制的是 “Ising 矩阵” 的 8-bit 整数精度，而不是原始 QUBO 矩阵本身的数值范围。
    # - 因此必须用 Kaiwu SDK 的精度适配接口来保证：
    #   QUBO -> Ising 之后满足 8bit（可整体缩放 + 取整）要求。
    print(">>> 执行 Kaiwu 精度适配：adjust_qubo_matrix_precision (bit_width=8)...")
    Q_adj = kw.qubo.adjust_qubo_matrix_precision(Q_matrix, bit_width=8)

    # 官方校验（复现平台报错的同款逻辑）
    print(">>> 校验：check_qubo_matrix_bit_width(bit_width=8)...")
    kw.qubo.check_qubo_matrix_bit_width(Q_adj, bit_width=8)
    print("PASS: QUBO 矩阵已满足 CIM 的 8-bit Ising 精度限制（通过 SDK 校验）")

    # 输出为整数 CSV（尽管 dtype 可能是 float64，但其值是整型）
    Q_int = np.rint(Q_adj).astype(int)
    # 保持上三角格式（与示例 CSV 一致）
    Q_int[np.tril_indices(Q_int.shape[0], -1)] = 0

    output_file = "QUBO_60bits_balanced_cim_ready.csv"
    print(f">>> 保存 QUBO(60) 到 {output_file} ...")
    pd.DataFrame(Q_int).to_csv(output_file, header=False, index=False)

    # 同时导出对应的 Ising 矩阵（会多一个辅助比特 n+1）
    ising_mat, bias = kw.conversion.qubo_matrix_to_ising_matrix(Q_adj)
    info = kw.ising.calculate_ising_matrix_bit_width(ising_mat, bit_width=8)
    print(f">>> Ising 精度信息: {info}, bias={bias}")

    ising_int = np.rint(ising_mat).astype(int)
    ising_int[np.tril_indices(ising_int.shape[0], -1)] = 0
    ising_file = "ISING_61bits_balanced_cim_ready.csv"
    print(f">>> 保存 Ising(61, 含辅助比特) 到 {ising_file} ...")
    pd.DataFrame(ising_int).to_csv(ising_file, header=False, index=False)
    
    # 同时保存一份变量索引映射，方便真机跑完后解码
    # 格式：index, var_name
    # 因为 Q 矩阵的第 i 行/列对应哪个变量的哪个 bit 很重要
    mapping_file = "QUBO_60bits_mapping.json"
    import json
    # 反转 var_index: {name: index} -> {index: name}
    index_to_name = {v: k for k, v in var_index.items()}
    # 按 index 排序列表
    mapping_list = [index_to_name[i] for i in range(len(index_to_name))]
    
    with open(mapping_file, 'w') as f:
        json.dump({
            "template": template,
            "bits_config": bits_config,
            "variable_mapping": mapping_list # index 0 -> name, index 1 -> name...
        }, f, indent=2)

    # Ising 的变量映射（多一个 aux spin，默认放在最后一位）
    ising_mapping_file = "ISING_61bits_mapping.json"
    ising_mapping = list(mapping_list) + ["aux_spin"]
    with open(ising_mapping_file, "w") as f:
        json.dump(
            {
                "template": template,
                "bits_config": bits_config,
                "ising_bias": float(bias),
                "ising_precision": info,
                "variable_mapping": ising_mapping,
            },
            f,
            indent=2,
        )
        
    print(f">>> 映射文件已保存到 {mapping_file}")
    print(f">>> Ising 映射文件已保存到 {ising_mapping_file}")
    print("完成。")

if __name__ == "__main__":
    generate_csv()

