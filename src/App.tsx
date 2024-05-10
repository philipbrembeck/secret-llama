import { Fragment, useState } from "react";
import * as webllm from "@mlc-ai/web-llm";
import UserInput from "./components/UserInput";
import useChatStore from "./hooks/useChatStore";
import ResetChatButton from "./components/ResetChatButton";
import ColorModeButton from "./components/ColorModeButton";
import DebugUI from "./components/DebugUI";
import ModelsDropdown from "./components/ModelsDropdown";
import MessageList from "./components/MessageList";
import useColorMode from "./hooks/useColorMode";
import useOLEDMode from "./hooks/useOLEDMode";
import OLEDModeButton from "./components/OLEDModeButton";
import checkWebGPUSupport from "./utils/checkWebGPUSupport";
import Modal from "./components/ui/dialog";
import { Transition, TransitionChild } from "@headlessui/react";
import { Button } from "./components/ui/button";

const appConfig = webllm.prebuiltAppConfig;
appConfig.useIndexedDBCache = true;

if (appConfig.useIndexedDBCache) {
  console.log("Using IndexedDB Cache");
} else {
  console.log("Using Cache API");
}

function App() {
  const [engine, setEngine] = useState<webllm.EngineInterface | null>(null);
  const [progress, setProgress] = useState("Not loaded");
  const { colorMode, toggleDarkMode } = useColorMode();
  const { oledMode, toggleOLEDMode } = useOLEDMode();

  const handleToggleColorMode = () => {
    if (colorMode === "dark" && oledMode) {
      toggleOLEDMode(); // This will turn off OLED mode if we are currently in dark mode and it's active
    }
    toggleDarkMode();
  };

  // Store
  const userInput = useChatStore((state) => state.userInput);
  const setUserInput = useChatStore((state) => state.setUserInput);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const setIsGenerating = useChatStore((state) => state.setIsGenerating);
  const chatHistory = useChatStore((state) => state.chatHistory);
  const setChatHistory = useChatStore((state) => state.setChatHistory);

  const systemPrompt = "You are a very helpful assistant.";
  // Respond in markdown.

  const initProgressCallback = (report: webllm.InitProgressReport) => {
    console.log(report);
    setProgress(report.text);
    setChatHistory((history) => [
      ...history.slice(0, -1),
      { role: "assistant", content: report.text },
    ]);
  };

  async function loadEngine() {
    console.log("Loading engine");

    setChatHistory((history) => [
      ...history.slice(0, -1),
      {
        role: "assistant",
        content: "Loading model... (this might take a bit)",
      },
    ]);
    const engine: webllm.EngineInterface = await webllm.CreateWebWorkerEngine(
      new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
      selectedModel,
      /*engineConfig=*/ {
        initProgressCallback: initProgressCallback,
        appConfig: appConfig,
      }
    );
    setEngine(engine);
    return engine;
  }

  async function onSend() {
    setIsGenerating(true);

    let loadedEngine = engine;

    // Add the user message to the chat history
    const userMessage: webllm.ChatCompletionMessageParam = {
      role: "user",
      content: userInput,
    };
    setChatHistory((history) => [
      ...history,
      userMessage,
      { role: "assistant", content: "" },
    ]);
    setUserInput("");

    // Start up the engine first
    if (!loadedEngine) {
      console.log("Engine not loaded");

      try {
        loadedEngine = await loadEngine();
      } catch (e) {
        setIsGenerating(false);
        console.error(e);
        setChatHistory((history) => [
          ...history.slice(0, -1),
          {
            role: "assistant",
            content: "Could not load the model because " + e,
          },
        ]);
        return;
      }
    }

    try {
      const completion = await loadedEngine.chat.completions.create({
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...chatHistory,
          userMessage,
        ],
        temperature: 0.5,
        max_gen_len: 1024,
      });

      // Get each chunk from the stream
      let assistantMessage = "";
      for await (const chunk of completion) {
        const curDelta = chunk.choices[0].delta.content;
        if (curDelta) {
          assistantMessage += curDelta;
          // Update the last message
          setChatHistory((history) => [
            ...history.slice(0, -1),
            { role: "assistant", content: assistantMessage },
          ]);
        }
      }

      setIsGenerating(false);

      console.log(await loadedEngine.runtimeStatsText());
    } catch (e) {
      setIsGenerating(false);
      console.error("EXCEPTION");
      console.error(e);
      setChatHistory((history) => [
        ...history,
        { role: "assistant", content: "Error. Try again." },
      ]);
      return;
    }
  }

  // Load the engine on first render
  // useEffect(() => {
  //   if (!engine) {
  //     loadEngine();
  //   }
  // }, []);

  async function resetChat() {
    if (!engine) {
      console.error("Engine not loaded");
      return;
    }
    await engine.resetChat();
    setUserInput("");
    setChatHistory(() => []);
  }

  async function resetEngineAndChatHistory() {
    if (engine) {
      await engine.unload();
    }
    setEngine(null);
    setUserInput("");
    setChatHistory(() => []);
  }

  function onStop() {
    if (!engine) {
      console.error("Engine not loaded");
      return;
    }

    setIsGenerating(false);
    engine.interruptGenerate();
  }

  const [webGPUInfo, setwebGPUInfo] = useState<boolean>(!checkWebGPUSupport());

  const [activeButton, setActiveButton] = useState<string | null>(null);

  return (
    <div className="px-4 w-full">
      <Modal
        open={webGPUInfo}
        setOpen={setwebGPUInfo}
        icon="error"
        title="WebGPU is not supported"
      >
        <p className="text-slate-600 prose">
          Your browser currently does not support WebGPU, which is necessary to
          run this tool. <br />
          Browsers that are supported are Chrome and Edge (with GPU required).{" "}
          <br />
          In other Browsers, there may be the possibility to enable the WebGPU
          flag in the settings.
          <br />
        </p>
        <p className="text-slate-600 prose">
          Click on one of those Browsers to get detailed instructions:
          <div className="flex justify-start items-start space-x-3 pt-5 pb-5">
            <Button
              variant="default"
              onClick={() =>
                setActiveButton(activeButton !== "firefox" ? "firefox" : null)
              }
            >
              Firefox
            </Button>

            <Button
              variant="default"
              onClick={() =>
                setActiveButton(activeButton !== "safari" ? "safari" : null)
              }
            >
              Safari for iOS
            </Button>

            <Button
              variant="default"
              onClick={() =>
                setActiveButton(activeButton !== "safariTP" ? "safariTP" : null)
              }
            >
              Safari TP
            </Button>
          </div>
          <Transition show={activeButton === "safariTP"} as={Fragment}>
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <ul className="prose">
                <li>
                  <strong>Safari (Developer Preview)</strong>:
                  <ol>
                    <li>Open Safari</li>
                    <li>Preferences</li>
                    <li>Feature Flags</li>
                    <li>Enable WebGPU if available</li>
                  </ol>
                </li>
              </ul>
            </TransitionChild>
          </Transition>
          <Transition show={activeButton === "safari"} as={Fragment}>
            <ul className="prose">
              <li>
                <strong>Safari for iOS</strong>:
                <ol>
                  <li>Open Preferences</li>
                  <li>Naviate to Safari</li>
                  <li>Tap to Advanced</li>
                  <li>Tap on Feature Flags</li>
                  <li>Enable WebGPU if available</li>
                </ol>
              </li>
            </ul>
          </Transition>
          <Transition show={activeButton === "firefox"} as={Fragment}>
            <ul className="prose">
              <li>
                <strong>Firefox</strong>:
                <ol>
                  <li>Open Firefox</li>
                  <li>Open about:config</li>
                  <li>Search for "dom.webgpu.enabled"</li>
                  <li>Set to "true"</li>
                  <li>Search for "gfx.webgpu.force-enabled"</li>
                  <li>Set to "true"</li>
                </ol>
              </li>
            </ul>
          </Transition>
          Looking for other browsers? Go to the{" "}
          <a href="https://caniuse.com/webgpu">caniuse-page for WebGPU</a>.
        </p>
      </Modal>

      <div className="absolute top-0 left-0 bg-white dark:bg-background 2xl:bg-transparent 2xl:dark:bg-transparent w-screen 2xl:w-auto shadow-[0_1.25px_0_0_rgba(234,242,250,1)] dark:shadow-[0_1.25px_0_0_rgba(28,38,46,1)] 2xl:shadow-none 2xl:dark:shadow-none p-4 flex items-center gap-2">
        <div>
          <ResetChatButton resetChat={resetChat} />
        </div>
        <div>
          <ColorModeButton
            toggleColorMode={handleToggleColorMode}
            colorMode={colorMode as "dark" | "light"}
          />
        </div>
        {colorMode === "dark" && (
          <div>
            <OLEDModeButton
              toggleOLEDMode={toggleOLEDMode}
              oledMode={oledMode}
            />
          </div>
        )}
        <DebugUI loadEngine={loadEngine} progress={progress} />
        <ModelsDropdown resetEngineAndChatHistory={resetEngineAndChatHistory} />
      </div>

      <div className="max-w-3xl mx-auto flex flex-col h-screen">
        {chatHistory.length === 0 ? (
          <div className="flex justify-center items-center h-full flex-col overflow-y-scroll">
            <img
              src="favicon.png"
              alt="Secret Llama"
              className="mx-auto w-32 rounded-full mb-4 mt-2"
            />
            <div className="max-w-2xl flex flex-col justify-center ">
              <h1 className="text-3xl font-medium  mb-8 leading-relaxed text-center">
                Welcome to Secret Llama
              </h1>
              <h2 className="text-base mb-4 prose dark:prose-light">
                Secret Llama is a free and fully private chatbot. Unlike
                ChatGPT, the models available here run entirely within your
                browser which means:
                <ol>
                  <li>Your conversation data never leaves your computer.</li>
                  <li>
                    After the model is initially downloaded, you can disconnect
                    your WiFi. It will work offline.
                  </li>
                </ol>
                <p>
                  Note: the first message can take a while to process because
                  the model needs to be fully downloaded to your computer. But
                  on future visits to this website, the model will load quickly
                  from the local storage on your computer.
                </p>
                <p>Supported browsers: Chrome, Edge (GPU required)</p>
                <p>
                  This project is open source.{" "}
                  <a
                    href="https://github.com/abi/secret-llama"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    See the Github page
                  </a>{" "}
                  for more details and to submit bugs and feature requests.
                </p>
              </h2>
            </div>
          </div>
        ) : (
          <MessageList />
        )}
        <UserInput onSend={onSend} onStop={onStop} />
      </div>
    </div>
  );
}

export default App;
