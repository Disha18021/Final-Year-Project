//FileList.js
import React, { useState, useEffect } from "react";

function FileList({ onFileSelect }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [encryptionKey, setEncryptionKey] = useState("");

  const isValidDate = (dateStr) => {
    const date = new Date(dateStr);
    return dateStr && !isNaN(date.getTime());
  };
  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);
      setError("");

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Authentication token not found. Please log in.");
        }

        const response = await fetch("http://localhost:5000/api/files", {
          headers: { Authorization: `Bearer ${token}` },
          mode: "cors",
        });

        if (!response.ok) {
          const errorMessage = await response.text();
          throw new Error(`Failed to fetch files: ${errorMessage}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid response format from server.");
        }

        setFiles(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, []);
  
  const handleDownload = async (fileId, filename) => {
    if (!encryptionKey || encryptionKey.length !== 32) {
      alert("Please enter a valid 32-character encryption key before downloading.");
      return;
    }
    const storedKey = localStorage.getItem(`encryptionKey_${filename}`);
    if (storedKey !== encryptionKey) {
      alert("Incorrect encryption key! Please enter the correct key used during upload.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("User not authenticated. Please log in.");
      }

      const response = await fetch(`http://localhost:5000/api/download/${fileId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        mode: "cors",
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${await response.text()}`);
      }

      const contentType = response.headers.get("Content-Type");
      if (!contentType.startsWith("image/")) {
        throw new Error("Downloaded file is not an image");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename; // Set dynamically fetched filename
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      alert("Error downloading file: " + error.message);
    }
  };



  return (
    <div className="p-6 bg-white shadow-md rounded-lg">
      <h2 className="text-xl font-bold mb-4">Your Files</h2>
      {loading && <p>Loading files...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      
      <div className="mb-4">
        <label className="block font-medium mb-2">Enter Encryption Key:</label>
        <input
          type="text"
          value={encryptionKey}
          onChange={(e) => setEncryptionKey(e.target.value)}
          placeholder="32-character encryption key"
          className="border p-2 w-full"
        />
      </div>

      {files.length > 0 ? (
        <ul className="divide-y divide-gray-300">
          {files.map((file) => (
            <li key={file._id} className="p-3 flex justify-between items-center">
              <div>
                <p className="font-medium">{file.filename}</p>
                <p className="text-sm text-gray-500">
                  Size: {(file.fileSize / 1024).toFixed(2)} KB | Uploaded By: {file.uploadedBy} | Date: {isValidDate(file.uploadedDate)
                    ? new Date(file.uploadedDate).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : "Unknown"}
                </p>
              </div>

              <button
                onClick={() => handleDownload(file._id, file.filename)}
                className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Download
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !loading && <p>No files available.</p>
      )}
    </div>
  );
}

export default FileList;
