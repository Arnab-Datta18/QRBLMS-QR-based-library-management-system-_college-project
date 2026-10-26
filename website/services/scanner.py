import cv2
import numpy as np

class CameraManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CameraManager, cls).__new__(cls)
            cls._instance.camera = None
            cls._instance.active = False
            cls._instance.last_scanned_code = None
        return cls._instance

    def start(self):
        if not self.active:
            if self.camera is None or not self.camera.isOpened():
                self.camera = cv2.VideoCapture(0)
            self.active = True

    def stop(self):
        if self.active:
            self.active = False
            if self.camera is not None and self.camera.isOpened():
                self.camera.release()
                self.camera = None

    def get_last_scanned(self):
        return self.last_scanned_code

    def reset_last_scanned(self):
        self.last_scanned_code = None

camera_manager = CameraManager()

def gen_frames():
    detector = cv2.QRCodeDetector()
    try:
        while True:
            if not camera_manager.active:
                black_frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(black_frame, "Scanner Stopped", (180, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                ret, buffer = cv2.imencode('.jpg', black_frame)
                yield (b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
                # If stopped, don't read from camera
                continue

            if camera_manager.camera is None or not camera_manager.camera.isOpened():
                break

            success, frame = camera_manager.camera.read()
            if not success:
                break

            data, _, _ = detector.detectAndDecode(frame)
            if data:
                camera_manager.last_scanned_code = data
                cv2.putText(frame, "QR DETECTED", (50, 80), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                
            ret, buffer = cv2.imencode('.jpg', frame)
            yield (b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            
    finally:
        # Stop and release camera when client disconnects (generator exits)
        camera_manager.stop()
