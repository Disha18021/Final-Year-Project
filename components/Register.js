import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../components/ui_components";
import { Button } from "../components/ui_components";
import { Input } from "../components/ui_components";
import { Label } from "../components/ui_components";


const Register = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    try {
        const response = await fetch("http://127.0.0.1:5000/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
    
        console.log("Response Status:", response.status);

        const data = await response.json().catch(() => null);
        console.log("Response Body:", data);
        if (response.ok) {
          alert("User registered successfully!");
          navigate("/Login");
        } else {
          alert(data.message);
        }
      } catch (error) {
        console.error("Error registering:", error);
        alert("Registration failed");
      }

    // Simulate user registration (Replace with actual backend API call)
// Redirect to login after successful registration
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <Card className="w-96 p-6">
        <CardContent>
          <h2 className="text-2xl font-bold mb-4">Register</h2>
          <form onSubmit={handleRegister}>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Label>Confirm Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            
            <Button type="submit" className="mt-4 w-full">
              Register
            </Button>
          </form>
          <p className="mt-4">
            Already have an account?{" "}
            <span
              className="text-blue-500 cursor-pointer"
              onClick={() => navigate("/Login")}
            >
              Login
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
