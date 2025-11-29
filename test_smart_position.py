#!/usr/bin/env python3
"""
测试智能仓位管理功能
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_portfolio_status():
    """测试获取组合状态"""
    print("=" * 60)
    print("测试：获取组合状态")
    print("=" * 60)
    
    try:
        response = requests.get(f"{BASE_URL}/position-manager/portfolio-status", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ 成功获取组合状态:")
            print(f"总资产: ${data.get('total_capital', 0):,.2f}")
            print(f"可用资金: ${data.get('available_cash', 0):,.2f}")
            print(f"持仓市值: ${data.get('market_value', 0):,.2f}")
            print(f"现金比例: {data.get('cash_ratio', 0)*100:.1f}%")
            print(f"持仓数量: {data.get('position_count', 0)}")
            return True
        else:
            print(f"\n❌ 失败: {response.status_code}")
            print(response.text)
            return False
    except requests.exceptions.ConnectionError:
        print("\n⚠️  无法连接到后端服务")
        print("请确保后端服务正在运行: ./start.sh")
        return False
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        return False

def test_calculate_position():
    """测试计算单个仓位"""
    print("\n" + "=" * 60)
    print("测试：计算买入仓位")
    print("=" * 60)
    
    request_data = {
        "symbol": "AAPL.US",
        "action": "buy",
        "method": "percentage",
        "target_allocation": 0.1,
        "max_risk": 0.02,
        "stop_loss_pct": 0.05
    }
    
    print(f"\n发送请求:")
    print(json.dumps(request_data, indent=2))
    
    try:
        response = requests.post(
            f"{BASE_URL}/position-manager/calculate",
            json=request_data,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ 计算成功:")
            print(f"股票: {data['symbol']}")
            print(f"操作: {data['action']}")
            print(f"建议数量: {data['quantity']} 股")
            print(f"预估价格: ${data['estimated_price']:.2f}")
            print(f"预估成本: ${data['estimated_cost']:.2f}")
            print(f"风险等级: {data['risk_level']}")
            print(f"最大损失: ${data['max_loss']:.2f}")
            print(f"建议止损: ${data['suggested_stop_loss']:.2f}")
            print(f"建议止盈: ${data['suggested_take_profit']:.2f}")
            print(f"说明: {data['reason']}")
            return True
        else:
            print(f"\n❌ 失败: {response.status_code}")
            error = response.json()
            print(f"错误: {error.get('detail', response.text)}")
            return False
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        return False

def test_batch_strategy():
    """测试批量生成策略"""
    print("\n" + "=" * 60)
    print("测试：批量生成策略")
    print("=" * 60)
    
    request_data = {
        "symbols": ["AAPL.US", "TSLA.US"],
        "strategy_type": "ma_crossover",
        "allocation_per_symbol": 0.1,
        "auto_execute": False
    }
    
    print(f"\n发送请求:")
    print(json.dumps(request_data, indent=2))
    
    try:
        response = requests.post(
            f"{BASE_URL}/position-manager/auto-strategy",
            json=request_data,
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ 生成成功:")
            print(f"处理了 {len(data)} 只股票:")
            
            for item in data:
                rec = item['recommendation']
                print(f"\n  股票: {item['symbol']}")
                print(f"  当前持仓: {'有' if item['current_position'] else '无'}")
                print(f"  建议数量: {rec['quantity']} 股")
                print(f"  预估成本: ${rec['estimated_cost']:.2f}")
                print(f"  风险等级: {rec['risk_level']}")
                print(f"  需创建策略: {'是' if item['create_strategy'] else '否'}")
            
            return True
        else:
            print(f"\n❌ 失败: {response.status_code}")
            error = response.json()
            print(f"错误: {error.get('detail', response.text)}")
            return False
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        return False

def main():
    print("\n智能仓位管理 API 测试")
    print("=" * 60)
    
    results = []
    
    # 测试 1: 获取组合状态
    results.append(("组合状态", test_portfolio_status()))
    
    # 测试 2: 计算仓位
    results.append(("计算仓位", test_calculate_position()))
    
    # 测试 3: 批量生成
    results.append(("批量生成", test_batch_strategy()))
    
    # 总结
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)
    
    for name, success in results:
        status = "✅ 通过" if success else "❌ 失败"
        print(f"{name}: {status}")
    
    passed = sum(1 for _, s in results if s)
    total = len(results)
    
    print(f"\n总计: {passed}/{total} 测试通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！")
    else:
        print("\n⚠️  部分测试失败，请检查后端服务和配置")
    
    print("\n" + "=" * 60)
    print("提示:")
    print("- 访问 http://localhost:8000 查看智能仓位界面")
    print("- 访问 http://localhost:8000/docs 查看 API 文档")
    print("- 查看 docs/SMART_POSITION_GUIDE.md 了解详细使用方法")
    print()

if __name__ == "__main__":
    main()

















