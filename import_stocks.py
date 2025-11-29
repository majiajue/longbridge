#!/usr/bin/env python3
"""
导入股票到选股池
支持日志格式的股票列表
"""
import sys
import os
import re

# 添加backend路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.stock_picker import get_stock_picker_service


def parse_log_format(log_line: str):
    """
    解析日志格式的股票列表
    
    输入示例:
    2025-10-23 15:58:32,914 | INFO | 多头: ['EUSM.US', 'DRI.US', ...]
    
    返回: (pool_type, symbols_list)
    """
    # 提取类型（多头/空头）
    if '多头' in log_line or 'LONG' in log_line.upper():
        pool_type = 'LONG'
    elif '空头' in log_line or 'SHORT' in log_line.upper():
        pool_type = 'SHORT'
    else:
        return None, []
    
    # 提取股票代码列表
    # 查找 ['XXX', 'YYY', ...] 格式
    match = re.search(r'\[(.*?)\]', log_line)
    if not match:
        return pool_type, []
    
    # 提取所有股票代码
    codes_str = match.group(1)
    symbols = re.findall(r"'([^']+)'", codes_str)
    
    return pool_type, symbols


def import_from_log(log_text: str):
    """
    从日志文本导入股票
    """
    service = get_stock_picker_service()
    
    lines = log_text.strip().split('\n')
    
    for line in lines:
        if not line.strip():
            continue
        
        pool_type, symbols = parse_log_format(line)
        
        if not symbols:
            continue
        
        print(f"\n{'='*60}")
        print(f"正在导入 {pool_type} 池: {len(symbols)} 只股票")
        print(f"{'='*60}\n")
        
        result = service.batch_add_stocks(pool_type, symbols)
        
        print(f"\n✅ 导入完成:")
        print(f"   总计: {result['total']}")
        print(f"   成功: {result['success_count']}")
        print(f"   失败: {len(result['failed'])}")
        
        if result['failed']:
            print(f"\n❌ 失败列表:")
            for item in result['failed']:
                print(f"   - {item['symbol']}: {item['error']}")


def import_from_lists(long_list: list, short_list: list):
    """
    从Python列表导入
    """
    service = get_stock_picker_service()
    
    print(f"\n{'='*60}")
    print(f"导入股票池")
    print(f"{'='*60}\n")
    
    # 导入做多池
    if long_list:
        print(f"📈 做多池: {len(long_list)} 只")
        result_long = service.batch_add_stocks('LONG', long_list)
        print(f"   成功: {result_long['success_count']}, 失败: {len(result_long['failed'])}")
    
    # 导入做空池
    if short_list:
        print(f"📉 做空池: {len(short_list)} 只")
        result_short = service.batch_add_stocks('SHORT', short_list)
        print(f"   成功: {result_short['success_count']}, 失败: {len(result_short['failed'])}")
    
    print(f"\n✅ 导入完成！")


def main():
    """
    主函数
    
    使用方法:
    1. 从日志导入:
       python import_stocks.py log "日志文本"
    
    2. 从列表导入:
       python import_stocks.py lists
    """
    
    # 用户提供的股票列表
    LONG_STOCKS = [
        'EUSM.US', 'DRI.US', 'GLP_B.US', 'DRVN.US', 'GMAB.US',
        'VPV.US', 'GMAR.US', 'WIW.US', 'DRLL.US', 'GMAY.US',
        'GME.US', 'DRIV.US', 'GMED.US', 'GMET.US', 'DRIP.US',
        'GMEY.US', 'GMF.US', 'VPU.US', 'DRIO.US', 'GLPI.US'
    ]
    
    SHORT_STOCKS = [
        'PTL.US', 'AFL.US', 'SPR.US', 'ZLAB.US', 'PSTG.US',
        'BABX.US', 'SPSK.US', 'BA.US', 'TLTI.US', 'PTBD.US',
        'PTHS.US', 'TLTP.US', 'SPPP.US', 'AZTR.US', 'PTIN.US',
        'PTIR.US', 'PTH.US', 'AFYA.US', 'PTIX.US', 'ZYXI.US'
    ]
    
    if len(sys.argv) > 1 and sys.argv[1] == 'log':
        # 从日志导入
        if len(sys.argv) > 2:
            log_text = sys.argv[2]
            import_from_log(log_text)
        else:
            print("请提供日志文本")
            sys.exit(1)
    else:
        # 从列表导入
        import_from_lists(LONG_STOCKS, SHORT_STOCKS)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n❌ 导入失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)











