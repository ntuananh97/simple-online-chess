import { PlayPage } from "@/components/play/play-page";

interface PageProps {
  params: Promise<{ roomCode: string }>;
}

export default async function Page({ params }: PageProps) {
  const { roomCode } = await params;

  return <PlayPage roomCode={roomCode} />;
}
