Aşağıdaki güncellenmiş adım adım rehberde “No space left on device” hatasıyla ve çözümüyle ilgili de bir bölümü ekledim. Baştan sona, yeni bir EC2 instance’tan DuckDNS+FastAPI servisinize kadar tüm adımlar yer alıyor.

---

## 1. EC2 Instance Oluşturma

1. **AWS Console → EC2 → Launch Instance**
2. **AMI**: Amazon Linux 2023
3. **Instance Type**: t3.medium (CPU-only demo) veya GPU gerekiyorsa g4dn.xlarge
4. **Key pair**: `.pem` anahtarınızı seçin, ec2-user
5. **Security group**:

   * SSH (22) → Source “My IP”
   * HTTP (80) → Source “Anywhere (0.0.0.0/0)”
   * HTTPS (443) → Source “Anywhere (0.0.0.0/0)”
6. **Launch** → Public IPv4 adresini not edin.

---

## 2. DuckDNS Subdomain Hazırlığı

1. **DuckDNS’e** ([https://www.duckdns.org](https://www.duckdns.org)) GitHub/GitLab ile giriş
2. “add domain” bölümüne subdomain (ör. `midog`) yazın → “add domain”
3. Ekranda gözüken **token**’ı kopyalayın
4. EC2’ye SSH ile bağlanın:

   ```bash
   chmod 400 ~/Downloads/mykey.pem
   ssh -i ~/Downloads/mykey.pem ec2-user@<ELASTIC_IP>
   ```
5. **Güncelleme script’i**:

   ```bash
   mkdir -p ~/duckdns && cd ~/duckdns
   cat > update.sh <<EOF
   #!/bin/bash
   DOMAIN="midog"
   TOKEN="YOUR_TOKEN_HERE"
   curl -s "https://www.duckdns.org/update?domains=\$DOMAIN&token=\$TOKEN&ip=" > /dev/null
   EOF
   chmod +x update.sh
   ```
6. **Cron job** (her 5 dakikada bir):

   ```bash
   sudo dnf install -y cronie
   sudo systemctl enable crond && sudo systemctl start crond
   echo "*/5 * * * * ec2-user /home/ec2-user/duckdns/update.sh >/dev/null 2>&1" | sudo tee /etc/cron.d/duckdns
   sudo systemctl restart crond
   ```
7. **Test**:

   ```bash
   ~/duckdns/update.sh
   ping -c2 midog.duckdns.org
   ```

---

## 3. Gerekli Paketlerin Kurulumu

```bash
sudo dnf update -y
sudo dnf install -y git nginx python3 python3-venv python3-pip certbot python3-certbot-nginx
sudo dnf install -y mesa-libGL mesa-libEGL libXrender libXrandr libXext libX11
```

---

## 4. “No space left on device” Hatası ve Çözümü

**Sorun:** `pip install torch` veya diğer büyük paketleri indirirken `/tmp` veya pip cache dizini dolu olduğu için `OSError(28, 'No space left on device')` hatası.

**Çözüm Adımları:**

1. **Boş alan ve inode kontrolü**

   ```bash
   df -h /
   df -i /
   ```

   (Kök partition’da yer ve inode varsa sorun geçici dizinde.)

2. **Yeni geçici dizin oluştur**

   ```bash
   sudo mkdir -p /opt/tmp
   sudo chown ec2-user:ec2-user /opt/tmp
   ```

3. **Ortam değişkenlerini ayarla**

   ```bash
   echo 'export TMPDIR=/opt/tmp' >> ~/.bashrc
   echo 'export XDG_CACHE_HOME=/opt/tmp/cache' >> ~/.bashrc
   source ~/.bashrc
   ```

4. **Pip cache’i temizle**

   ```bash
   pip cache purge
   ```

5. **Cache’siz kurulum**

   ```bash
   pip install --no-cache-dir torch
   # veya requirements.txt için:
   pip install --no-cache-dir -r requirements.txt
   ```

6. **(Gerekirse) Build isolation’ı kapat**

   ```bash
   pip install --no-cache-dir --no-build-isolation <paket_adı>
   ```

Böylece pip’in geçici dosyalarını geniş `/opt/tmp`’de tutarak “no space” hatasını önlemiş olursunuz.

---

## 5. Uygulamayı Çekme ve Virtualenv

```bash
sudo mkdir -p /opt/midog
sudo chown ec2-user:ec2-user /opt/midog
cd /opt/midog

git clone <GIT_REPO_URL> MIDOGpp-Refine-inference-web

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn gunicorn ultralytics torch boto3
```

---

## 6. systemd Servis Yapılandırması

```bash
sudo tee /etc/systemd/system/midog.service <<EOF
[Unit]
Description=MiDog FastAPI Service
After=network.target

[Service]
User=ec2-user
Group=ec2-user
WorkingDirectory=/opt/midog/MIDOGpp-Refine-inference-web
ExecStart=/opt/midog/venv/bin/gunicorn server:app \\
          --workers 4 \\
          --worker-class uvicorn.workers.UvicornWorker \\
          --bind 127.0.0.1:8000 \\
          --timeout 120

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable midog
sudo systemctl start midog
sudo systemctl status midog
```

---

## 7. Nginx Reverse Proxy Ayarı

```bash
sudo tee /etc/nginx/conf.d/midog.conf <<'EOF'
server {
    listen 80;
    server_name midog.duckdns.org;
    client_max_body_size 2G;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name midog.duckdns.org;
    client_max_body_size 2G;

    ssl_certificate     /etc/letsencrypt/live/midog.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/midog.duckdns.org/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    location /predict {
        # Dosyayı direkt FastAPI’ye stream et
        proxy_request_buffering off;

        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /health {
        proxy_pass http://127.0.0.1:8000/health;
    }
}
EOF

sudo nginx -t
sudo systemctl reload nginx
```
degisiklik yaparsan
```bash
sudo nginx -t
sudo systemctl reload nginx
```
not:
proxy_request_buffering off; (yapmassan resim dosyasini fastapi okuyamiyor)
client_max_body_size 2G; (yapmazsan buyuk resim gonderilemiyor)

---

## 8. Let’s Encrypt SSL Kurulumu

```bash
sudo systemctl stop nginx
sudo certbot certonly --standalone \
  --agree-tos \
  --no-eff-email \
  --email youremail@example.com \
  -d midog.duckdns.org

sudo systemctl start nginx
sudo nginx -t && sudo systemctl reload nginx
```

---

## 9. Son Testler

1. **Backend**:

   ```bash
   curl -i http://127.0.0.1:8000/health
   ```
2. **HTTPS**:

   ```bash
   curl -ik https://midog.duckdns.org/health
   ```
3. **Predict** (örnek):

   ```bash
   curl -X POST https://midog.duckdns.org/predict \
     -H "Content-Type: application/json" \
     -d '{"your":"input"}'
   ```



## Yeniden baslatma:
   ```bash
   sudo systemctl restart midog
   ```
   gerekirse:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable midog
   sudo systemctl start midog
   ```

## Loglama
```bash
   sudo journalctl -u midog -n 50
   ```
```bash
   sudo journalctl -u midog -f
   ```

   

