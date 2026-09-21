import { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
export default function VoiceRecorder({ onAudio }) {
  const [recording, setRecording] = useState(false),
    [seconds, setSeconds] = useState(0),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const recorder = useRef(null),
    stream = useRef(null);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(
      () =>
        setSeconds((s) => {
          if (s >= 119) recorder.current?.stop();
          return s + 1;
        }),
      1000,
    );
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  async function start() {
    try {
      setError("");
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const rec = new MediaRecorder(stream.current),
        chunks = [];
      recorder.current = rec;
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType });
        setUrl(URL.createObjectURL(blob));
        onAudio(blob);
        setRecording(false);
        stream.current.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      setSeconds(0);
      setRecording(true);
    } catch (e) {
      setError(
        "Microphone unavailable or permission denied. You can submit a text report.",
      );
    }
  }
  return (
    <div className="voice">
      <Mic size={27} />
      <h3>Capture from the field</h3>
      <p>
        Up to two minutes · English · Local Whisper transcription after upload
      </p>
      {recording ? (
        <button type="button" onClick={() => recorder.current.stop()}>
          <Square size={16} /> Stop · {seconds}s
        </button>
      ) : (
        <button type="button" onClick={start}>
          <Mic size={16} />
          Start recording
        </button>
      )}
      {url && (
        <>
          <audio controls src={url} />
          <button
            type="button"
            onClick={() => {
              setUrl("");
              onAudio(null);
            }}
          >
            <Trash2 size={15} />
            Discard recording
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
