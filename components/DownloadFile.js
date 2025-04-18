//DownloadFile.js
import React, { useState, useEffect } from "react";

const DownloadFile = ({ fileId }) => {
    const [encryptionKey, setEncryptionKey] = useState("");
    const [message, setMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setMessage(""); // Clear previous messages when file changes
    }, [fileId]);

    const handleDownload = async () => {
        if (!fileId || !encryptionKey) {
            setMessage("Please enter the encryption key.");
            return;
        }
        setIsLoading(true);
        setMessage("");

        try {
            const response = await fetch(`http://localhost:5000/api/download/${fileId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                     
                },
                body: JSON.stringify({ encryption_key: encryptionKey }),
            });

            if (!response.ok) {
                throw new Error("Failed to get download URL. Please check the encryption key.");
            }
            const contentDisposition = response.headers.get("Content-Disposition");
            let filename = "decrypted_file";
            if (contentDisposition) {
                const match = contentDisposition.match(/filename\*?=["']?(?:UTF-8'')?([^;"']+)/);
                if (match) {
                    filename = decodeURIComponent(match[1]);
                }
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

            setMessage("File downloaded successfully!");
        } catch (error) {
            setMessage(`❌ ${error.message}`);
        }
        finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "5px", maxWidth: "400px" }}>
            <h2>Download Decrypted File</h2>
            <p><b>File ID:</b> {fileId || "Select a file from the list"}</p>
            <input 
                type="password" 
                placeholder="Enter Encryption Key" 
                value={encryptionKey} 
                onChange={(e) => setEncryptionKey(e.target.value)} 
                disabled={isLoading}
                style={{ display: "block", marginBottom: "10px", width: "100%", padding: "8px" }}
            />
            <button 
                onClick={handleDownload} 
                disabled={!fileId || isLoading} 
                style={{ 
                    padding: "10px", 
                    backgroundColor: isLoading ? "#aaa" : "#007bff", 
                    color: "white", 
                    border: "none", 
                    borderRadius: "5px", 
                    cursor: isLoading ? "not-allowed" : "pointer",
                    width: "100%"
                }}
            >
                {isLoading ? "Downloading..." : "Download File"}
            </button>
            <p style={{ color: message.includes("✅") ? "green" : "red", marginTop: "10px" }}>{message}</p>
        </div>
    );
};

export default DownloadFile;
