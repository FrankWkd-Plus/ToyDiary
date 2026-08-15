import asyncio
import os
import sys
import ring_sound as sdk

# 替换为实际的戒指 MAC 地址
ADDRESS = "E2:C5:D7:16:6E:EA"

async def main() -> None:
    # 获取当前脚本所在的绝对路径目录
    if getattr(sys, 'frozen', False):
        # 如果是打包后的可执行文件
        script_dir = os.path.dirname(sys.executable)
    else:
        # 如果是直接运行 .py 脚本
        script_dir = os.path.dirname(os.path.abspath(__file__))
    
    output_wav_path = os.path.join(script_dir, "result.wav")

    print(f"正在连接戒指 (MAC: {ADDRESS})...")
    
    try:
        # 使用上下文管理器自动管理 BLE 连接的生命周期
        async with sdk.RingSoundClient(address=ADDRESS) as ring:
            print("连接成功！请在戒指上长按录音，完成后松开...")
            print("等待接收录音数据中（超时时间 120 秒）...")
            
            # 接收保存后设备主动上报的连续 0x0505 录音数据
            file_index, raw_audio = await sdk.receive_auto_audio_file(
                ring,
                timeout_s=120.0,
            )
            
            print(f"接收到录音！文件索引: {file_index}, 原始数据大小: {len(raw_audio)} 字节")
            print("正在解码并转换为 WAV 格式...")
            
            # 将原始 Speex 数据解码为 WAV 字节
            wav_bytes = sdk.decode_audio_to_wav(raw_audio)
            
            # 将 WAV 字节写入同目录下的 result.wav
            with open(output_wav_path, "wb") as f:
                f.write(wav_bytes)
                
            print(f"处理完成！WAV 文件已成功保存至:\n{output_wav_path}")
            
    except sdk.TransportError as e:
        print(f"[错误] 蓝牙传输异常: {e}\n请检查蓝牙是否开启、是否安装了 bleak，以及设备是否在广播。")
    except sdk.TimeoutError:
        print("[错误] 等待超时：未在规定时间内收到录音数据。请确认是否触发了录音操作。")
    except sdk.SpeexDecoderUnavailable:
        print("[错误] 解码失败：系统中未找到 ffmpeg。请确保已安装 ffmpeg 并可在命令行中执行 `ffmpeg -version`。")
    except sdk.AudioDecodeError as e:
        print(f"[错误] 音频解码异常: {e}")
    except sdk.RingSoundError as e:
        print(f"[错误] SDK 通用异常: {e}")
    except Exception as e:
        print(f"[错误] 发生未知异常: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n程序已被用户手动中断。")
