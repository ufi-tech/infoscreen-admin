

# If Chromium crashes (usually due to rebooting), clear the crash flag so we don't have the annoying warning bar
# waits for 10 seconds before opening URL
# To disable screen saver timeout
#move pointer to
MAC="klikdata-"$(cat /sys/class/net/eth0/address | sed -e 's/://g')
CURRENT_HOSTNAME=$(cat /proc/sys/kernel/hostname)
chattr -i /etc/hostname
echo "$MAC" > "/etc/hostname"
chattr -i /etc/hosts
sed -i "s/127.0.1.1.*$CURRENT_HOSTNAME/127.0.1.1\t$MAC/g" /etc/hosts
hostname $MAC
chattr +i /etc/hostname
chattr +i /etc/hosts

#MAC=$(cat /sys/class/net/eth0/address)
xte 'mousemove 1280 1920'

xset s 0
# To disabled Monitor going to sleep
xset -dpms
# clean up if the power or ssh in and poweroff or if hostname changes
rm -rf ~/.config/chromium/Singleton*
# Waits for 10 seconds before starting up
sleep 10
# Make sure to change the user name if it's not default pi
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/'  /home/pi/ .config/chromium/Default/Preferences
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/'  /home/pi/.config/chromium/Default/Preferences
#chromium-browser --kiosk --disable-restore-session-state --disable-session-crashed-bubble --noerrordialogs --disable-infobars --disable-features=TranslateUI --disable-translate --no-first-run --fast --fast-start http://google.dk &
#chromium-browser --window-position=0,0    --kiosk --disable-restore-session-state --disable-session-crashed-bubble --noerrordialogs --disable-infobars --user-data-dir="/home/pi/Documents/Profiles/0" https://theslideshow.net/#simple/dog
#chromium-browser --window-position=1020,0 --kiosk --disable-restore-session-state --disable-session-crashed-bubble --noerrordialogs --disable-infobars --user-data-dir="/home/pi/Documents/Profiles/1" https://theslideshow.net/#simple/llama
#@chromium-browser --new-window --user-data-dir=/tmp/browser-1 --window-position="0,0" --start-fullscreen --kiosk --autoplay-policy=no-user-gesture-required --incognito --noerrdialogs --disable-translate --no-first-run --fast --fast-start --disable-infobars --disable-features=TranslateUI --disk-cache-dir=/dev/null http://google.com &

#@chromium-browser --new-window --user-data-dir=/tmp/browser-2 --window-position="1920,0" --start-fullscreen --kiosk --autoplay-policy=no-user-gesture-required --incognito --noerrdialogs --disable-translate --no-first-run --fast --fast-start --disable-infobars --disable-features=TranslateUI --disk-cache-dir=/dev/null http://bing.com
#bash /home/pi/startcam &


#chromium-browser --kiosk --disable-restore-session-state  --disable-session-crashed-bubble --noerrordialogs --disable-infobars --disable-features=TranslateUI --disable-translate --no-first-run --fast --fast-start "http://dmi.klikdata.dk/?zipcode=6800&graph_width=50&graph_height=100" &
#chromium-browser --kiosk --disable-restore-session-state  --disable-session-crashed-bubble --noerrordialogs --disable-infobars --disable-features=TranslateUI --disable-translate --no-first-run --fast --fast-start "https://gpsalarm.net/infoscreen/?MAC=$MAC" &
#chromium-browser --kiosk --disable-restore-session-state  --disable-session-crashed-bubble --noerrordialogs --disable-infobars --disable-features=TranslateUI --disable-translate --no-first-run --fast --fast-start "https://viewer.klikdata.dk"  &



#sleep 35 
#xte 'mousemove 650 960'
#sleep 1 
#xte 'mouseclick 1'
#sleep 1 
#xte 'key Tab' 'key Tab' 'key Tab' 'key Return'
#sleep 1
#xte 'mousemove 1281 1921'
#bash /home/pi/startcam  &

