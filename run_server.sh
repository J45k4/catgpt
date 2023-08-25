mkdir -p /var/log/aki/ && touch /var/log/aki/aki.log
nohup cargo run --release server 2>&1 | tee /var/log/aki/aki.log &