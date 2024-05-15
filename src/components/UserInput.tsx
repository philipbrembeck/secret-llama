import { FaArrowUp } from "react-icons/fa6";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import useChatStore from "../hooks/useChatStore";
import { MODEL_DESCRIPTIONS } from "../models";
import { useRef, useState } from "react";
import Modal from "./ui/dialog";
import { SparklesIcon } from "@heroicons/react/24/outline";

function UserInput({
  onSend,
  onStop,
}: {
  onSend: () => Promise<void>;
  onStop: () => void;
}) {
  const userInput = useChatStore((state) => state.userInput);
  const setUserInput = useChatStore((state) => state.setUserInput);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const isGenerating = useChatStore((state) => state.isGenerating);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    await onSend();
  };

  const [infoModal, setinfoModal] = useState(false);

  return (
    <div className="p-4 py-2">
      <div className="relative flex items-end p-2 border rounded-xl shadow-sm">
        <Textarea
          ref={textareaRef}
          autosize
          rows={1}
          className="flex-1 max-h-[320px] pb-[6px] border-none shadow-none focus:ring-0 
              ring-0 focus:border-0 focus-visible:ring-0 text-base
              resize-none"
          placeholder={`Message ${MODEL_DESCRIPTIONS[selectedModel].displayName}`}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          value={userInput}
        />
        {!isGenerating && (
          <Button className="p-2" variant="ghost" onClick={onSend}>
            <FaArrowUp className="h-5 w-5 text-gray-500" />
          </Button>
        )}
        {isGenerating && <Button onClick={onStop}>Stop</Button>}
      </div>
      <a
        href="#"
        onClick={() => setinfoModal(true)}
        className="text-xs text-gray-400 hover:underline mt-2 text-right flex justify-end w-full"
      >
        Info &amp; Disclaimer
      </a>

      <Modal
        open={infoModal}
        setOpen={setinfoModal}
        icon="info"
        title="Info & Disclaimer"
      >
        <p className="font-bold text-black">Legal</p>
        <p className="text-slate-600">
          This website is provided as open source software as-is and makes no
          representations or warranties of any kind concerning its accuracy,
          safety, or suitability.
          <br />
          The user assumes full responsibility for any consequences resulting
          from its use.
          <br />
          We disclaim all liability for any direct, indirect, or consequential
          harm that may result.
        </p>
        <p>
          <br />
        </p>

        <p className="font-bold text-black">Deployment</p>
        <p className="text-slate-600">
          This fork of <SparklesIcon className="h-4 w-4 inline-block" /> {""}
          <a href="https://github.com/abi/secret-llama" className="underline">
            secret-llama
          </a>{" "}
          <SparklesIcon className="h-4 w-4 inline-block" /> is deployed on the{" "}
          <a href="https://frontendnet.work" className="underline">
            FrontendNetworks
          </a>{" "}
          Kubernetes Cluster using a custom Dockerfile, which is available at:
          <br />
          <code className="text-xs inline-flex text-left items-center space-x-4 bg-gray-900 text-white rounded-sm shadow-xl p-4 pl-6 mt-5 mb-5">
            <span className="flex gap-4">
              <span className="shrink-0 text-gray-500">$</span>

              <span className="flex-1">
                <span className="text-green-500">docker</span> pull ghcr.io/
                <span className="text-yellow-500">philipbrembeck</span>/
                <span className="text-yellow-500">secret-llama:main</span>
              </span>
            </span>
          </code>
          This uses minimal ressources on the Cluster, HELM-Chart will be also
          provided soon.
        </p>
      </Modal>
    </div>
  );
}

export default UserInput;
