import { describe, it, expect } from "vitest";
import { ordersAPI } from "./backend-api";

describe("Backend Connection Validation", () => {
  it("should successfully connect to backend via ngrok", async () => {
    // Test backend connectivity by calling a simple API
    try {
      const result = await ordersAPI.list({ orgId: 1, page: 1, pageSize: 1 });
      
      // If we get here without throwing, the connection works
      expect(result).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      
      console.log("✅ Backend connection successful via ngrok");
      console.log(`   Backend URL: ${process.env.BACKEND_URL}`);
      console.log(`   Response: ${result.data.length} orders returned`);
    } catch (error: any) {
      // Log detailed error for debugging
      console.error("❌ Backend connection failed:");
      console.error(`   Backend URL: ${process.env.BACKEND_URL}`);
      console.error(`   Error: ${error.message}`);
      
      // Re-throw to fail the test
      throw error;
    }
  }, 30000); // 30 second timeout for network requests
});
