from flask import  request, jsonify
from config import app, db
from models import Learner

@app.route("/hello", methods=["GET"])
def hello_world():
    return jsonify({"hello" : "world"})

if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    app.run(debug=True)