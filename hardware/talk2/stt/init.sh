# 临时禁用所有 USB 设备的自动挂起
for dev in /sys/bus/usb/devices/*/power/control; do
    echo "on" | sudo tee $dev
done

cp -r /home/talk2/stt/vosk-model-small-cn-0.22 /dev/shm/
