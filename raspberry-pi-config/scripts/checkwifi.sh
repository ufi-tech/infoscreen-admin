ping -c4 google.com > /dev/null
if [ $? != 0 ] 
then
sudo /sbin/shutdown -r now
fi
