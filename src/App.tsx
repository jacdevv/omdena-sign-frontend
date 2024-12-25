import { useCallback, useRef, useState } from "react";
import Webcam from "react-webcam";
import { ChevronDown, CloudUpload } from "lucide-react";
import clsx from "clsx";
import { initializeApp } from "firebase/app";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { ScrollArea } from "@/components/ui/scroll-area";
import firebaseConfig from "../firebase_config.json";

function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
  );
}

function App() {
  const app = initializeApp(firebaseConfig);
  const storage = getStorage(app);

  const [video, setVideo] = useState<"text" | "video">("text");
  const [input, setInput] = useState<string>("Senyum");
  const [dropDownOpen, setDropDownOpen] = useState<boolean>(false);

  // Media stuff
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState<boolean>(false);

  // New state for previewing uploaded file
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [inference, setInference] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState<string>("idle");
  const [videoPlaying, setVideoPlaying] = useState<boolean>(false);

  const [confidence, setConfidence] = useState<number | null>(null);

  const handleInput = (e: string) => {
    if (e.includes(" ")) {
      setVideoPlaying(false);
      setInput(e.trim());
    } else {
      setVideoPlaying(false);
      setInput(e);
    }
  };

  const startRecording = useCallback(() => {
    if (webcamRef.current?.video) {
      const stream = webcamRef.current.video.srcObject as MediaStream;
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "video/webm",
      });

      const chunks: BlobPart[] = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const recordedBlob = new Blob(chunks, { type: "video/webm" });
        handleUpload(recordedBlob);
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  const handleUpload = (blob: Blob) => {
    setUploadProgress(0);
    setCurrentState("Uploading");
    if (blob) {
      const storageRef = ref(storage, `videos/${Date.now()}.webm`);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload failed:", error);
        },
        () => {
          setCurrentState("inferring");
          setUploadProgress(null);
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            handleInference(downloadURL);
          });
        }
      );
    } else {
      console.error("No video blob available for upload");
    }
  };

  const handleInference = async (downloadURL: string) => {
    try {
      const response = await fetch(
        "https://louisljz-bisindo-sign-lang-recog.hf.space/predict",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ url: downloadURL }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.confidence > 0.4) {
          setInference(data.label);
          setConfidence(data.confidence);
        } else {
          setInference("Unknown");
          setConfidence(data.confidence);
        }
        setFilePreview(null);
      } else {
        console.error("Inference failed");
        setFilePreview(null);
      }
    } catch (err) {
      console.error("Inference error:", err);
    } finally {
      setCurrentState("idle");
    }
  };

  let wordOptions = [
    "adik",
    "anak",
    "besar",
    "buka",
    "buruk",
    "dengar",
    "gembira",
    "guru",
    "haus",
    "ibu",
    "jalan",
    "keluarga",
    "kertas",
    "kucing",
    "lapar",
    "lihat",
    "maaf",
    "main",
    "makan",
    "marah",
    "minum",
    "nama",
    "orang",
    "panggil",
    "rumah",
    "sedikit",
    "selamat",
    "senyum",
    "teman",
    "tidur",
  ];

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      <nav className="mx-auto max-w-3xl mt-4 flex justify-between">
        <h1 className="font-bold text-xl text-white">
          Indonesian Sign Translation by Omdena
        </h1>
        <a
          className="flex items-center gap-2"
          href="https://huggingface.co/spaces/Louisljz/bisindo-sign-lang-recog/tree/main"
        >
          <img
            src="/hf-logo.svg"
            width={36}
            className="object-contain aspect-square "
          />
        </a>
      </nav>
      <div className="mx-auto max-w-3xl flex flex-col gap-6 mt-8">
        <div className="flex items-center h-min gap-4">
          <p className="text-white">
            Powered by machine learning, made by humans.
          </p>
        </div>
        <div className="rounded-lg h-96 grid grid-cols-2 gap-4">
          <button
            className="z-10 fixed -translate-x-1/2 left-1/2 top-40 bg-[#346AFF] w-16 h-16 rounded-full flex justify-center items-center text-white border-background border-4 "
            onClick={() => {
              setVideo(video === "text" ? "video" : "text");
            }}
          >
            {"<=>"}
          </button>
          <div className="bg-[#1A1C1E] rounded-3xl max-w-full">
            {video == "text" && (
              <>
                <div className="absolute px-6 py-4 text-white flex gap-4 w-full items-center">
                  <p>From</p>
                  <button
                    className={clsx(
                      "w-64 h-10 bg-background rounded-3xl flex justify-center items-center px-6 relative",
                      dropDownOpen && "rounded-t-3xl rounded-b-none"
                    )}
                    onClick={() => {
                      setDropDownOpen(!dropDownOpen);
                    }}
                  >
                    <p
                      className={clsx(
                        "",
                        wordOptions.includes(input.toLowerCase())
                          ? "text-blue-500"
                          : "text-white"
                      )}
                    >
                      {toTitleCase(input)}
                    </p>
                    <div className="flex justify-end w-full">
                      <ChevronDown />
                    </div>
                    {dropDownOpen && (
                      <div className="absolute top-full left-0 bg-background w-64 h-40 rounded-b-3xl">
                        <ScrollArea className="h-40">
                          <ul className="flex flex-col items-start px-6 gap-2">
                            {wordOptions.map((word) => (
                              <li
                                key={word}
                                className={clsx(
                                  "hover:text-[#346AFF]",
                                  word === input && "text-[#346AFF]"
                                )}
                              >
                                <button
                                  onClick={() => {
                                    handleInput(word);
                                  }}
                                >
                                  {toTitleCase(word)}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </div>
                    )}
                  </button>
                </div>
                <div className="flex justify-center items-center h-full">
                  <input
                    value={toTitleCase(input)}
                    onChange={(e) => {
                      handleInput(e.target.value);
                    }}
                    className={clsx(
                      "focus:outline-none bg-transparent text-center text-3xl",
                      wordOptions.includes(input.toLowerCase())
                        ? "text-[#346AFF]"
                        : "text-white"
                    )}
                  />
                </div>
              </>
            )}
            {video == "video" && (
              <div className="relative">
                {filePreview ? (
                  <video
                    src={filePreview}
                    controls
                    autoPlay
                    muted
                    className="rounded-t-3xl border-b-[#346AFF] border-dashed border-b-2"
                  />
                ) : (
                  <Webcam
                    ref={webcamRef}
                    mirrored={true}
                    audio={false}
                    videoConstraints={{
                      width: 1280,
                      height: 920,
                      facingMode: "user",
                    }}
                    className="rounded-t-3xl border-b-[#346AFF] border-dashed border-b-2"
                  />
                )}

                {uploadProgress != null && uploadProgress > 0 && (
                  <div className="absolute top-4 right-4 text-xl z-10 text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
                    Upload: {Math.round(uploadProgress)}%
                  </div>
                )}
                {currentState == "inferring" && (
                  <div className="absolute top-4 right-4 text-xl z-10 text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
                    Inferring...
                  </div>
                )}

                {!filePreview && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-56 bg-background rounded-full w-10 h-10 flex justify-center items-center p-2">
                    {recording && (
                      <button
                        onClick={() => {
                          stopRecording();
                        }}
                      >
                        O
                      </button>
                    )}
                    {!recording && (
                      <button
                        className="bg-red-700 w-full h-full rounded-full"
                        onClick={startRecording}
                      ></button>
                    )}
                  </div>
                )}
                <div className="h-full flex flex-col gap-2 items-center">
                  <div className="w-full flex justify-center text-white pt-2">
                    Or
                  </div>
                  <div className="w-full flex justify-center">
                    <div className="w-full flex justify-center">
                      <input
                        type="file"
                        accept="video/*"
                        id="file-upload"
                        className="hidden"
                        disabled={currentState != "idle"}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setFilePreview(URL.createObjectURL(file));
                            handleUpload(file);
                          }
                        }}
                      />
                      <label
                        htmlFor="file-upload"
                        className="p-4 w-min h-10 bg-background rounded-3xl flex justify-center items-center gap-2 cursor-pointer"
                      >
                        <p className="text-white text-sm whitespace-nowrap">
                          Choose files
                        </p>
                        <CloudUpload className="shrink-0 text-[#346AFF]" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="bg-[#1A1C1E] rounded-3xl">
            {video == "text" && (
              <div className="relative h-full">
                <div className="w-full h-full grid place-items-center text-white">
                  {wordOptions.includes(input.toLowerCase()) && (
                    <video
                      className="w-[360px]  rounded-3xl"
                      width={1000}
                      height={1000}
                      autoPlay
                      loop
                      muted
                      src={`https://storage.cloud.google.com/omdena-videos/skeletons-webm/${input.toLowerCase()}.webm`}
                      onPlay={() => setVideoPlaying(true)}
                    />
                  )}
                  {!videoPlaying && (
                    <div role="status" className="absolute">
                      <svg
                        aria-hidden="true"
                        className="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-[#346AFF]"
                        viewBox="0 0 100 101"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 
                          0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 
                          50 0.59082C77.6142 0.59082 100 22.9766 
                          100 50.5908ZM9.08144 50.5908C9.08144 73.1895 
                          27.4013 91.5094 50 91.5094C72.5987 91.5094 
                          90.9186 73.1895 90.9186 50.5908C90.9186 
                          27.9921 72.5987 9.67226 50 9.67226C27.4013 
                          9.67226 9.08144 27.9921 9.08144 50.5908Z"
                          fill="currentColor"
                        />
                        <path
                          d="M93.9676 39.0409C96.393 
                          38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 
                          28.8227 92.871 24.3692 89.8167 20.348C85.8452 
                          15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 
                          4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 
                          0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 
                          1.69328 37.813 4.19778 38.4501 6.62326C39.0873 
                          9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 
                          9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 
                          10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 
                          17.9648 79.3347 21.5619 82.5849 25.841C84.9175 
                          28.9121 86.7997 32.2913 88.1811 35.8758C89.083 
                          38.2158 91.5421 39.6781 93.9676 39.0409Z"
                          fill="currentFill"
                        />
                      </svg>
                      <span className="sr-only">Loading...</span>
                    </div>
                  )}
                </div>
                <a
                  className="absolute bottom-5 left-5 text-white bg-[#346AFF] py-2 px-4 text-sm rounded-3xl"
                  href={`https://storage.cloud.google.com/omdena-videos/skeletons-webm/${input.toLowerCase()}.webm`}
                >
                  Download animation
                </a>
              </div>
            )}
            {video == "video" && (
              <div className="w-full h-full grid place-items-center text-white text-4xl">
                {inference
                  ? String(inference).charAt(0).toUpperCase() +
                    String(inference).slice(1) +
                    " " +
                    (confidence ? `(${Math.round(confidence * 100)}%)` : "")
                  : "Waiting..."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
