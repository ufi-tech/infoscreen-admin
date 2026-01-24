rm /tmp/BackupDestination
mkdir /tmp/BackupDestination
mount -t cifs -o username=admin,password=15mmledning //192.168.1.8/Server /tmp/BackupDestination
dd bs=4M if=/dev/mmcblk0 | gzip -c >/tmp/BackupDestination/viewer.img.gz











