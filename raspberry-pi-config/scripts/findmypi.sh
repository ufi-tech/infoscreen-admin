#!/bin/bash

#check if already running
if [ "$(pgrep -x $(basename $0))" != "$$" ]; then
	if [ "$1" != "-q" ];then
		echo "Already running!"
	fi
	exit 1;
fi

#assign values for later on
FOUNDIP=0
HOSTNAME=$(hostname)

# send to the server
submitIP(){
	/usr/bin/wget -q --post-data "int=$1&ipadr=$2&macadr=$3&hostname=$HOSTNAME" https://jemi.dk/findmypi/save.php -O /dev/null
	if [ $? -ne 0 ]; then
		if [ "$4" != "-q" ];then
			echo Kunne ikke gemme i Findmypi databasen
		fi
		exit 1
	fi
}

# wait for devices up
if (/sbin/ip -o link show | grep -v lo: | awk '{print $2,$9}' | grep -q UP); then
	if [ "$1" != "-q" ];then
		echo "Netværkskort         OK!"
	fi
else
	if [ "$1" != "-q" ];then
		echo "Netværkskort         FEJL!"
		echo "Venter 20 sekunder..."
	fi
	sleep 20
fi

# wait for ping
if ping -c 1 jemi.dk  &> /dev/null; then
	if [ "$1" != "-q" ];then
		echo "jemi.dk ping         OK!"
	fi
else
	if [ "$1" != "-q" ];then
		echo "jemi.dk ping         FEJL!"
		echo "Venter 20 sekunder..."
	fi
	sleep 20
fi

#try ping again
if ! ping -c 1 jemi.dk  &> /dev/null; then
	if [ "$1" != "-q" ];then
		echo "jemi.dk ping         FEJL!"
		echo "Opgiver..."
	fi
	exit 1;
fi

# Test for network conection
for IFACE in $(ls /sys/class/net/ | grep -v lo);
do
	NETADR=$(/sbin/ifconfig $IFACE 2>&1 | grep inet | awk '{print $2}' | cut -d':' -f2);
	MACADR=$(/sbin/ifconfig $IFACE 2>&1 | grep HWaddr | awk '{print $5}');
	PRINTHEAD=true
	if [ "$NETADR" != "" ]; then
		if [ "$1" != "-q" ];then
			if ($PRINTHEAD); then
				PRINTHEAD=false;
				echo
				printf '%-18s %-18s %-18s %s\n' Interface MacAdr IP Hostname
				echo "-------------------------------------------------------------------------"
			fi
			OUTMAC=${MACADR//:/}
			printf '%-18s %-18s %-18s %s\n' $IFACE $OUTMAC $NETADR $HOSTNAME
		fi
		submitIP $IFACE $NETADR $MACADR $1
		FOUNDIP=$((FOUNDIP+1))
	fi
done

# result
if [ "$FOUNDIP" -gt 0 ]; then
	if [ "$1" != "-q" ];then
		echo
		echo "Fandt $FOUNDIP enhede(r) - se dine enheder vha. http://jemi.dk/findmypi/"
		echo
	fi
	exit 0
else
	if [ "$1" != "-q" ];then
		echo
		echo "Fandt ingen netværkskort/ip adresser!"
		echo
	fi
	exit 1
fi
