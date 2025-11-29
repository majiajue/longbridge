#!/usr/bin/env python3
"""
测试策略创建 API 的简单脚本
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_create_strategy():
    """测试创建策略"""
    print("=" * 60)
    print("测试创建新策略")
    print("=" * 60)
    
    # 创建测试策略
    strategy_data = {
        "name": "测试均线策略",
        "description": "这是一个测试策略，用于验证 API 功能",
        "symbols": ["AAPL.US", "TSLA.US"],
        "strategy_type": "ma_crossover"
    }
    
    print(f"\n发送请求创建策略:")
    print(json.dumps(strategy_data, indent=2, ensure_ascii=False))
    
    try:
        response = requests.post(
            f"{BASE_URL}/strategies/",
            json=strategy_data,
            timeout=5
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ 创建成功!")
            print(f"策略 ID: {result['strategy_id']}")
            print(f"消息: {result['message']}")
            return result['strategy_id']
        else:
            print(f"\n❌ 创建失败: {response.status_code}")
            print(response.text)
            return None
            
    except requests.exceptions.ConnectionError:
        print("\n⚠️  无法连接到后端服务")
        print("请确保后端服务正在运行: ./start.sh")
        return None
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        return None

def test_list_strategies():
    """测试列出所有策略"""
    print("\n" + "=" * 60)
    print("查看所有策略")
    print("=" * 60)
    
    try:
        response = requests.get(f"{BASE_URL}/strategies/", timeout=5)
        
        if response.status_code == 200:
            strategies = response.json()
            print(f"\n当前共有 {len(strategies)} 个策略:")
            for strategy in strategies:
                enabled = "✓" if strategy['enabled'] else "✗"
                print(f"  [{enabled}] {strategy['id']}: {strategy['name']}")
                print(f"      标的: {', '.join(strategy['symbols'])}")
                print(f"      状态: {strategy['status']}")
            return strategies
        else:
            print(f"\n❌ 查询失败: {response.status_code}")
            return []
            
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        return []

def test_delete_strategy(strategy_id):
    """测试删除策略"""
    print("\n" + "=" * 60)
    print(f"删除策略: {strategy_id}")
    print("=" * 60)
    
    try:
        response = requests.delete(
            f"{BASE_URL}/strategies/{strategy_id}",
            timeout=5
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ 删除成功!")
            print(f"消息: {result['message']}")
            return True
        elif response.status_code == 400:
            print(f"\n⚠️  无法删除: 策略可能处于启用状态")
            print("请先在界面上禁用策略，然后再删除")
            return False
        else:
            print(f"\n❌ 删除失败: {response.status_code}")
            print(response.text)
            return False
            
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        return False

def main():
    print("\n策略创建 API 测试工具")
    print("=" * 60)
    
    # 1. 查看现有策略
    strategies = test_list_strategies()
    
    # 2. 创建新策略
    strategy_id = test_create_strategy()
    
    if strategy_id:
        # 3. 再次查看策略列表
        test_list_strategies()
        
        # 4. 提示如何删除
        print("\n" + "=" * 60)
        print("如何删除测试策略:")
        print("=" * 60)
        print(f"\n方法 1 - 使用界面:")
        print("  1. 访问策略控制页面")
        print("  2. 找到 '测试均线策略'")
        print("  3. 确保策略已禁用（开关为关）")
        print("  4. 点击左下角的删除图标")
        
        print(f"\n方法 2 - 使用 API:")
        print(f"  curl -X DELETE {BASE_URL}/strategies/{strategy_id}")
        
        print(f"\n方法 3 - 使用本脚本:")
        print(f"  要删除刚创建的测试策略，请先在界面上禁用它")
        print(f"  然后运行: python test_strategy_creation.py delete {strategy_id}")
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)
    print("\n提示:")
    print("- 访问 http://localhost:8000 查看策略控制界面")
    print("- 访问 http://localhost:8000/docs 查看 API 文档")
    print("- 查看 docs/STRATEGY_CREATION_GUIDE.md 了解详细使用方法")
    print()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 2 and sys.argv[1] == "delete":
        test_delete_strategy(sys.argv[2])
    else:
        main()
