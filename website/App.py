import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash
from models import db, Librarian
from routes.auth_routes import auth_bp
from routes.web_routes import web_bp
from routes.api_routes import api_bp

# Load environment variables from .env file
load_dotenv()

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})
    
    # Configure app from environment variables
    app.secret_key = os.getenv("FLASK_SECRET_KEY", "final_project_key")
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///library.db'
    app.config['UPLOAD_FOLDER'] = 'static/uploads'
    app.config['QR_FOLDER'] = 'static/qrcodes'

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['QR_FOLDER'], exist_ok=True)

    # Initialize extensions
    db.init_app(app)

    # Register Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(web_bp)
    app.register_blueprint(api_bp)

    def is_api_request():
        return request.path.startswith('/api/')

    @app.errorhandler(400)
    def bad_request_error(e):
        if is_api_request():
            return jsonify({"error": "Bad Request", "message": str(e.description if hasattr(e, 'description') else e)}), 400
        return "<h1>400 Bad Request</h1><p>The request could not be understood by the server.</p>", 400

    @app.errorhandler(401)
    def unauthorized_error(e):
        if is_api_request():
            return jsonify({"error": "Unauthorized", "message": str(e.description if hasattr(e, 'description') else e)}), 401
        return "<h1>401 Unauthorized</h1><p>You are not authorized to access this resource.</p>", 401

    @app.errorhandler(403)
    def forbidden_error(e):
        if is_api_request():
            return jsonify({"error": "Forbidden", "message": str(e.description if hasattr(e, 'description') else e)}), 403
        return "<h1>403 Forbidden</h1><p>You don't have permission to access this resource.</p>", 403

    @app.errorhandler(404)
    def not_found_error(e):
        if is_api_request():
            return jsonify({"error": "Not Found", "message": "The requested URL was not found on the server."}), 404
        return "<h1>404 Not Found</h1><p>The page you are looking for does not exist.</p>", 404

    @app.errorhandler(500)
    def internal_server_error(e):
        if is_api_request():
            return jsonify({"error": "Internal Server Error", "message": "An unexpected error occurred."}), 500
        return "<h1>500 Internal Server Error</h1><p>An unexpected error occurred. Please try again later.</p>", 500

    return app

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        try:
            db.create_all()
            
            # --- START MIGRATION FOR STUDENT TABLE ---
            from sqlalchemy import text
            try:
                db.session.execute(text('ALTER TABLE student ADD COLUMN phone VARCHAR(20)'))
                db.session.commit()
            except Exception:
                db.session.rollback()
                
            try:
                db.session.execute(text('ALTER TABLE student ADD COLUMN profile_pic_url VARCHAR(200)'))
                db.session.commit()
            except Exception:
                db.session.rollback()
            # --- END MIGRATION FOR STUDENT TABLE ---

            if not Librarian.query.filter_by(id='admin').first():
                # Hash default admin password
                hashed_pw = generate_password_hash('1234')
                default_admin = Librarian(id='admin', password=hashed_pw)
                db.session.add(default_admin)
                db.session.commit()
        finally:
            db.session.remove()

    flask_debug = os.getenv("FLASK_DEBUG", "True").lower() in ['true', '1', 't', 'yes', 'y']
    app.run(host='0.0.0.0', port=5000, debug=flask_debug)