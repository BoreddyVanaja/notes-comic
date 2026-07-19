from flask import Flask, render_template, request, jsonify
from services.content_generator import generate_comic_and_quiz
from services.comic_generator import build_panels_from_captions

app = Flask(__name__)

# ---------------- Home ----------------
@app.route("/")
def home():
    return render_template("index.html")


# ---------------- Combined Comic + Quiz API ----------------
# Uses ONE Gemini call for captions + quiz + mind map (saves free-tier quota),
# then generates images separately via the free Pollinations service.
@app.route("/api/generate-all", methods=["POST"])
def generate_all():
    try:
        data = request.get_json()
        notes = data.get("notes")
        panel_count = int(data.get("panelCount", 4))
        question_count = int(data.get("questionCount", 5))

        if not notes:
            return jsonify({"error": "Notes are required."}), 400

        content = generate_comic_and_quiz(notes, panel_count, question_count)
        panels = build_panels_from_captions(content["panelCaptions"])

        return jsonify({
            "panels": panels,
            "mindMap": content["mindMap"],
            "questions": content["questions"]
        }), 200

    except ValueError as e:
        # Friendly, expected errors (quota exceeded, bad model output, etc.)
        return jsonify({"error": str(e)}), 429 if "quota" in str(e).lower() else 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- Main (only used for local testing) ----------------
if __name__ == "__main__":
    print(app.url_map)
    app.run(host="0.0.0.0", port=5000, debug=True)
