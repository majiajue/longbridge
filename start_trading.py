#!/usr/bin/env python3
"""
Longbridge 量化交易系统启动脚本

此脚本用于启动自动交易系统，包括：
1. 检查环境和依赖
2. 验证配置文件
3. 启动后端服务
4. 初始化策略引擎
"""
import os
import sys
import subprocess
import asyncio
import logging
from pathlib import Path

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_python_version():
    """检查Python版本"""
    if sys.version_info < (3, 9):
        logger.error("需要 Python 3.9 或更高版本")
        return False
    logger.info(f"Python 版本: {sys.version}")
    return True

def check_longport_sdk():
    """检查 Longbridge SDK"""
    try:
        import longport
        logger.info(f"Longbridge SDK 已安装: {longport.__version__}")
        return True
    except ImportError:
        logger.error("Longbridge SDK 未安装，请运行: pip install longport")
        return False

def check_required_files():
    """检查必要的配置文件"""
    required_files = [
        "config/strategies.json",
        "backend/app/main.py",
        "frontend/package.json"
    ]

    missing_files = []
    for file_path in required_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)

    if missing_files:
        logger.error(f"缺少必要文件: {missing_files}")
        return False

    logger.info("所有必要文件存在")
    return True

def check_credentials():
    """检查 Longbridge 凭据配置"""
    required_env = ["LONGPORT_APP_KEY", "LONGPORT_APP_SECRET", "LONGPORT_ACCESS_TOKEN"]
    missing_env = []

    for env_var in required_env:
        if not os.getenv(env_var):
            missing_env.append(env_var)

    if missing_env:
        logger.warning(f"缺少环境变量: {missing_env}")
        logger.info("请在系统中设置这些环境变量，或通过前端界面配置")
        return False

    logger.info("Longbridge 凭据已配置")
    return True

def install_backend_deps():
    """安装后端依赖"""
    logger.info("检查后端依赖...")
    try:
        os.chdir("backend")
        if not Path(".venv").exists():
            logger.info("创建虚拟环境...")
            subprocess.run([sys.executable, "-m", "venv", ".venv"], check=True)

        if os.name == "nt":  # Windows
            pip_path = ".venv/Scripts/pip"
            python_path = ".venv/Scripts/python"
        else:  # Unix/Linux/MacOS
            pip_path = ".venv/bin/pip"
            python_path = ".venv/bin/python"

        logger.info("安装依赖...")
        subprocess.run([pip_path, "install", "-e", "."], check=True)
        subprocess.run([pip_path, "install", "longport"], check=True)

        os.chdir("..")
        return python_path

    except subprocess.CalledProcessError as e:
        logger.error(f"安装后端依赖失败: {e}")
        os.chdir("..")
        return None

def install_frontend_deps():
    """安装前端依赖"""
    logger.info("检查前端依赖...")
    try:
        os.chdir("frontend")

        if not Path("node_modules").exists():
            logger.info("安装前端依赖...")
            subprocess.run(["npm", "install"], check=True)

        os.chdir("..")
        return True

    except subprocess.CalledProcessError as e:
        logger.error(f"安装前端依赖失败: {e}")
        os.chdir("..")
        return False
    except FileNotFoundError:
        logger.error("npm 未找到，请先安装 Node.js")
        os.chdir("..")
        return False

async def test_backend():
    """测试后端服务"""
    logger.info("测试后端服务连接...")
    try:
        import aiohttp

        async with aiohttp.ClientSession() as session:
            async with session.get('http://localhost:8000/health') as resp:
                if resp.status == 200:
                    logger.info("后端服务正常运行")
                    return True
                else:
                    logger.warning(f"后端服务响应异常: {resp.status}")
                    return False

    except Exception as e:
        logger.info("后端服务尚未启动")
        return False

def start_backend(python_path):
    """启动后端服务"""
    logger.info("启动后端服务...")
    try:
        if os.name == "nt":  # Windows
            cmd = f'start cmd /k "cd backend && {python_path} -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"'
            os.system(cmd)
        else:  # Unix/Linux/MacOS
            subprocess.Popen([
                python_path, "-m", "uvicorn", "app.main:app",
                "--reload", "--host", "0.0.0.0", "--port", "8000"
            ], cwd="backend")

        logger.info("后端服务启动中... (http://localhost:8000)")
        return True

    except Exception as e:
        logger.error(f"启动后端服务失败: {e}")
        return False

def start_frontend():
    """启动前端开发服务器"""
    logger.info("启动前端开发服务器...")
    try:
        if os.name == "nt":  # Windows
            cmd = 'start cmd /k "cd frontend && npm run dev"'
            os.system(cmd)
        else:  # Unix/Linux/MacOS
            subprocess.Popen(["npm", "run", "dev"], cwd="frontend")

        logger.info("前端服务启动中... (http://localhost:5173)")
        return True

    except Exception as e:
        logger.error(f"启动前端服务失败: {e}")
        return False

async def main():
    """主启动流程"""
    logger.info("=== Longbridge 量化交易系统启动 ===")

    # 检查基础环境
    if not check_python_version():
        return False

    if not check_required_files():
        return False

    # 安装依赖
    python_path = install_backend_deps()
    if not python_path:
        return False

    if not install_frontend_deps():
        return False

    # 检查 Longport SDK
    if not check_longport_sdk():
        logger.warning("Longport SDK 未安装，某些功能可能无法使用")

    # 检查凭据（警告但不阻止启动）
    check_credentials()

    # 检查后端是否已经在运行
    backend_running = await test_backend()

    if not backend_running:
        # 启动后端
        if not start_backend(python_path):
            return False

        # 等待后端启动
        logger.info("等待后端服务启动...")
        for i in range(30):  # 等待最多30秒
            await asyncio.sleep(1)
            if await test_backend():
                break
        else:
            logger.error("后端服务启动超时")
            return False

    # 启动前端
    start_frontend()

    logger.info("=== 启动完成 ===")
    logger.info("访问地址:")
    logger.info("  前端界面: http://localhost:5173")
    logger.info("  后端API: http://localhost:8000")
    logger.info("  API文档: http://localhost:8000/docs")
    logger.info("")
    logger.info("使用说明:")
    logger.info("1. 在设置页面配置 Longbridge 凭据")
    logger.info("2. 添加要监控的股票代码")
    logger.info("3. 在策略控制中心启用交易策略")
    logger.info("4. 实时监控交易执行情况")
    logger.info("")
    logger.info("按 Ctrl+C 停止服务")

    try:
        # 保持脚本运行，直到用户中断
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("正在停止服务...")
        return True

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("用户中断启动")
        sys.exit(0)
    except Exception as e:
        logger.error(f"启动失败: {e}")
        sys.exit(1)