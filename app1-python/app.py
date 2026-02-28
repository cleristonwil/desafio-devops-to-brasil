from flask import Flask
from datetime import datetime

app = Flask(__name__)

@app.route("/")
def hello():
    return "Olá! Esta é a App 1 - Python Flask", 200

@app.route("/time")
def current_time():
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return f"Horário atual do servidor (App 1): {now}", 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)