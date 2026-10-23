import { useState } from "react";
import { previewFile } from "../services/api";

export default function useFilePreview() {
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadPreview = async (file) => {
    setPreviewLoading(true);
    try {
      return await previewFile(file);
    } finally {
      setPreviewLoading(false);
    }
  };

  return { previewLoading, loadPreview };
}
