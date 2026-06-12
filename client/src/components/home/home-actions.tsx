"use client";

import { LogIn, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";

export function HomeActions() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button
        size="lg"
        className="h-12 flex-1 gap-2 text-base shadow-sm"
        onClick={() => {
          // TODO: tạo phòng và chuyển tới bàn cờ
        }}
      >
        <Swords className="size-5" />
        Play Game
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="h-12 flex-1 gap-2 text-base"
        onClick={() => {
          // TODO: nhập mã phòng và tham gia
        }}
      >
        <LogIn className="size-5" />
        Join
      </Button>
    </div>
  );
}
