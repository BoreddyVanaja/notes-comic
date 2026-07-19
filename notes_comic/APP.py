from flask import Flask, render_template, request, jsonify
from services.comic_generator import generate_comic
from services.quiz_generator import generate_quiz

app = Flask(__name__)

# ---------------- Home ----------------
@app.route("/")
def home():
    return render_template("index.html")

# ---------------- Comic API ----------------
@app.route("/api/generate-comic", methods=["POST"])
def comic():
    try:
        data = request.get_json()
        notes = data.get("notes")
        panel_count = int(data.get("panelCount", 4))

        if not notes:
            return jsonify({"error": "Notes are required."}), 400

        panels = generate_comic(notes, panel_count)

        if not panels:
            return jsonify({"error": "Comic generation returned no panels. Please try again."}), 500

        return jsonify({"panels": panels}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- Quiz API ----------------
@app.route("/api/generate-quiz", methods=["POST"])
def quiz():
    try:
        data = request.get_json()
        notes = data.get("notes")
        question_count = int(data.get("questionCount", 5))

        if not notes:
            return jsonify({"error": "Notes are required."}), 400

        result = generate_quiz(notes, question_count)

        if not result or not result.get("questions"):
            return jsonify({"error": "Quiz generation returned no questions. Please try again."}), 500

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- Main (only used for local testing) ----------------
if __name__ == "__main__":
    print(app.url_map)
    app.run(host="0.0.0.0", port=5000, debug=True)