"use client";

import { useEffect, useRef, useState } from "react";
import { Topic, TranscriptSegment, PlaybackCommand, Citation, VideoPlatform } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { VideoProgressBar } from "@/components/video-progress-bar";
import { YouTubePlayer } from "./youtube-player";
import { BilibiliPlayer } from "./bilibili-player";

interface VideoPlayerProps {
  platform: VideoPlatform;
  videoId: string;
  selectedTopic: Topic | null;
  onTimeUpdate?: (seconds: number) => void;
  playbackCommand?: PlaybackCommand | null;
  onCommandExecuted?: () => void;
  onPlayerReady?: () => void;
  topics?: Topic[];
  onTopicSelect?: (topic: Topic, fromPlayAll?: boolean) => void;
  onPlayTopic?: (topic: Topic) => void;
  transcript?: TranscriptSegment[];
  isPlayingAll?: boolean;
  playAllIndex?: number;
  onTogglePlayAll?: () => void;
  setPlayAllIndex?: (index: number | ((prev: number) => number)) => void;
  setIsPlayingAll?: (playing: boolean) => void;
  renderControls?: boolean;
  onDurationChange?: (duration: number) => void;
}

export function VideoPlayer({
  platform,
  videoId,
  selectedTopic,
  onTimeUpdate,
  playbackCommand,
  onCommandExecuted,
  onPlayerReady,
  topics = [],
  onTopicSelect,
  onPlayTopic,
  transcript = [],
  isPlayingAll = false,
  playAllIndex = 0,
  onTogglePlayAll,
  setPlayAllIndex,
  setIsPlayingAll,
  renderControls = true,
  onDurationChange,
}: VideoPlayerProps) {

  if (platform === 'youtube') {
    return (
      <YouTubePlayer
        videoId={videoId}
        selectedTopic={selectedTopic}
        onTimeUpdate={onTimeUpdate}
        playbackCommand={playbackCommand}
        onCommandExecuted={onCommandExecuted}
        onPlayerReady={onPlayerReady}
        topics={topics}
        onTopicSelect={onTopicSelect}
        onPlayTopic={onPlayTopic}
        transcript={transcript}
        isPlayingAll={isPlayingAll}
        playAllIndex={playAllIndex}
        onTogglePlayAll={onTogglePlayAll}
        setPlayAllIndex={setPlayAllIndex}
        setIsPlayingAll={setIsPlayingAll}
        renderControls={renderControls}
        onDurationChange={onDurationChange}
      />
    );
  }

  if (platform === 'bilibili') {
    return (
      <BilibiliPlayer
        videoId={videoId}
        selectedTopic={selectedTopic}
        onTimeUpdate={onTimeUpdate}
        playbackCommand={playbackCommand}
        onCommandExecuted={onCommandExecuted}
        onPlayerReady={onPlayerReady}
        topics={topics}
        onTopicSelect={onTopicSelect}
        onPlayTopic={onPlayTopic}
        transcript={transcript}
        isPlayingAll={isPlayingAll}
        playAllIndex={playAllIndex}
        onTogglePlayAll={onTogglePlayAll}
        setPlayAllIndex={setPlayAllIndex}
        setIsPlayingAll={setIsPlayingAll}
        renderControls={renderControls}
        onDurationChange={onDurationChange}
      />
    );
  }

  return (
    <Card className="overflow-hidden shadow-sm p-0">
      <div className="relative bg-black overflow-hidden aspect-video">
        <div className="absolute inset-0 flex items-center justify-center text-white">
          不支持的视频平台
        </div>
      </div>
    </Card>
  );
}