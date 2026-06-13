"use client";
import { toast } from "sonner";
import { LogIn, Loader2, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { roomApi } from "@/lib/api/room.api";
import { useUserStore } from "@/stores/useUserStore";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function HomeActions() {
  const getUserId = useUserStore((state) => state.getUserId);
  const [loading, setLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const router = useRouter();

  const [roomCode, setRoomCode] = useState("");

  const handleCreateRoom = async () => {
    try {
      const userId = getUserId();
      setLoading(true);
      const response = await roomApi.createRoom(userId);
      setLoading(false);
      toast.success("Room created successfully");
      router.push(`/play/${response.code}`);
    } catch {
      setLoading(false);
      toast.error("Failed to create room");
    }
  };

  const handleJoinRoom = async () => {
    try {
      const userId = getUserId();
      setJoinLoading(true);
      const response = await roomApi.joinRoom({
        code: roomCode,
        blackId: userId,
      });
      toast.success("Joined room successfully");
      router.push(`/play/${response.code}`);
    } catch {
      setJoinLoading(false);
      toast.error("Failed to join room");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        size="lg"
        className="h-12  gap-2 text-base shadow-sm "
        onClick={handleCreateRoom}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Swords className="size-5" />
        )}
        Play Game
      </Button>
      <div className="flex flex-col gap-3 shrink-0">
        <Input
          type="text"
          placeholder="Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
        />
        <Button
          variant="outline"
          size="lg"
          className="h-12  gap-2 text-base"
          onClick={handleJoinRoom}
          disabled={joinLoading}
        >
          {joinLoading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <LogIn className="size-5" />
          )}
          Join
        </Button>
      </div>
    </div>
  );
}
