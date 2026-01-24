#!/bin/bash
MAC="klikdata-"$(cat /sys/class/net/eth0/address | sed -e 's/://g')


echo $MAC
CURRENT_HOSTNAME=$(cat /proc/sys/kernel/hostname)
chattr -i /etc/hostname
echo "$MAC" > "/etc/hostname"
chattr -i /etc/hosts
sed -i "s/127.0.1.1.*$CURRENT_HOSTNAME/127.0.1.1\t$MAC/g" /etc/hosts
hostname $MAC
chattr +i /etc/hostname
chattr +i /etc/hosts
