//Upload.js
import React, { useState } from "react";

function Upload() {
  const [file, setFile] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) {
      alert("Please select a file.");
      return;
    }
    
    const allowedTypes = ["text/plain", "application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(selectedFile.type)) {
      alert("Invalid file type. Please upload .txt, .pdf, .jpg, or .png files.");
      return;
    }
    
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file to upload.");
      return;
    }
    if (!encryptionKey) {
      alert("Please enter a 32-character encryption key before uploading.");
      return;
    }
  
    if (encryptionKey.length !== 32) {
      alert("Invalid encryption key. Please enter a valid 32-character key.");
      return;
    }

    localStorage.setItem(`encryptionKey_${file.name}`, encryptionKey);

    setLoading(true);
    setError("");
    setSuccessMessage("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("encryption_key", encryptionKey);
    formData.append("filename", file.name);
    formData.append("fileSize", file.size);
    formData.append("contentType", file.type);
    formData.append("uploadedBy", localStorage.getItem("username")); // Assume user info stored locally
    formData.append("uploadedDate", new Date().toISOString());

    try {
      const token = localStorage.getItem("token"); // Get JWT token from localStorage
      if (!token) {
        throw new Error("User not authenticated. Please log in.");
      }

      const response = await fetch("http://localhost:5000/api/upload", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to upload file.");
      }

      setSuccessMessage("File uploaded successfully!");
      setFile(null);
      setEncryptionKey("");
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-6 shadow-lg rounded-xl w-96">
        <h2 className="text-2xl font-bold text-center mb-4">Secure File Upload</h2>

        {error && <p className="text-red-500">{error}</p>}
        {successMessage && <p className="text-green-500">{successMessage}</p>}

        <input 
          type="file" 
          accept=".txt,.pdf,.jpg,.png" 
          onChange={handleFileChange} 
          className="mb-3 border p-2 w-full"
        />

        <input
          type="text"
          placeholder="Enter 32-character encryption key"
          value={encryptionKey}
          onChange={(e) => setEncryptionKey(e.target.value)}
          className="mb-3 border p-2 w-full"
        />

        <button 
          onClick={handleUpload} 
          disabled={loading} 
          className={`w-full py-2 text-white rounded-md ${loading ? "bg-gray-500" : "bg-blue-500 hover:bg-blue-600"}`}
        >
          {loading ? "Uploading..." : "Upload File"}
        </button>
      </div>
    </div>
  );
}

export default Upload;
