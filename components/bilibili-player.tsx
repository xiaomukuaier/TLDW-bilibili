"use client";

import { useEffect, useRef, useState } from "react";
import { Topic, TranscriptSegment, PlaybackCommand, Citation } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { VideoProgressBar } from "@/components/video-progress-bar";

interface BilibiliPlayerProps {
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

export function BilibiliPlayer({
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
}: BilibiliPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [citationReelSegmentIndex, setCitationReelSegmentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSeekingRef = useRef(false);
  const isPlayingAllRef = useRef(false);
  const playAllIndexRef = useRef(0);
  const topicsRef = useRef<Topic[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    isPlayingAllRef.current = isPlayingAll;
  }, [isPlayingAll]);

  useEffect(() => {
    playAllIndexRef.current = playAllIndex;
  }, [playAllIndex]);

  useEffect(() => {
    topicsRef.current = topics;
  }, [topics]);

  useEffect(() => {
    setVideoDuration(0);
    setCurrentTime(0);
    onDurationChange?.(0);

    if (!videoId) return;

    let mounted = true;

    const initializePlayer = () => {
      if (!mounted) return;

      // Bilibili player is embedded via iframe
      // We'll use a simple approach for now - in production you might want to use
      // Bilibili's official player API if available
      setPlayerReady(true);
      onPlayerReady?.();

      // For Bilibili, we'll estimate duration based on topics/transcript
      // In a real implementation, you'd get this from Bilibili API
      if (transcript.length > 0) {
        const lastSegment = transcript[transcript.length - 1];
        const estimatedDuration = lastSegment.start + lastSegment.duration;
        setVideoDuration(estimatedDuration);
        onDurationChange?.(estimatedDuration);
      }
    };

    // Simulate player initialization
    setTimeout(initializePlayer, 100);

    return () => {
      mounted = false;
      setPlayerReady(false);

      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    };
  }, [videoId, transcript, onDurationChange, onPlayerReady]);

  // Centralized command executor
  useEffect(() => {
    if (!playbackCommand || !playerReady) return;

    const executeCommand = () => {
      switch (playbackCommand.type) {
        case 'SEEK':
          if (playbackCommand.time !== undefined) {
            setCurrentTime(playbackCommand.time);
            // In a real implementation, you would seek the Bilibili player
            // For now, we just update the UI state
          }
          break;

        case 'PLAY_TOPIC':
          if (playbackCommand.topic) {
            const topic = playbackCommand.topic;
            onTopicSelect?.(topic);
            if (topic.segments.length > 0) {
              setCurrentTime(topic.segments[0].start);
              if (playbackCommand.autoPlay) {
                setIsPlaying(true);
              }
            }
          }
          break;

        case 'PLAY_SEGMENT':
          if (playbackCommand.segment) {
            setCurrentTime(playbackCommand.segment.start);
            setIsPlaying(true);
          }
          break;

        case 'PLAY_CITATIONS':
          if (playbackCommand.citations && playbackCommand.citations.length > 0) {
            // Create citation reel topic
            const citationReel: Topic = {
              id: `citation-reel-${Date.now()}`,
              title: "引用片段",
              description: "播放AI回复中引用的所有片段",
              duration: playbackCommand.citations.reduce((total, c) => total + (c.end - c.start), 0),
              segments: playbackCommand.citations.map(c => ({
                start: c.start,
                end: c.end,
                text: c.text,
                startSegmentIdx: c.startSegmentIdx,
                endSegmentIdx: c.endSegmentIdx,
                startCharOffset: c.startCharOffset,
                endCharOffset: c.endCharOffset,
              })),
              isCitationReel: true,
              autoPlay: true,
            };
            onTopicSelect?.(citationReel);
            setCurrentTime(playbackCommand.citations[0].start);
            if (playbackCommand.autoPlay) {
              setIsPlaying(true);
            }
          }
          break;

        case 'PLAY_ALL':
          if (topics.length > 0) {
            // Play All state is already set in requestPlayAll
            // Just select the first topic and start playing
            onTopicSelect?.(topics[0], true);  // Pass true for fromPlayAll
            setCurrentTime(topics[0].segments[0].start);
            if (playbackCommand.autoPlay) {
              setIsPlaying(true);
            }
          }
          break;

        case 'PLAY':
          setIsPlaying(true);
          break;

        case 'PAUSE':
          setIsPlaying(false);
          break;
      }

      // Clear command after execution
      onCommandExecuted?.();
    };

    // Execute with small delay to ensure player stability
    const timeoutId = setTimeout(executeCommand, 50);
    return () => clearTimeout(timeoutId);
  }, [playbackCommand, playerReady, topics, onCommandExecuted, onTopicSelect, setIsPlayingAll, setPlayAllIndex]);

  // Reset segment index when topic changes and auto-play if needed
  useEffect(() => {
    setCitationReelSegmentIndex(0);
    // Auto-play if the topic has the autoPlay flag
    if (selectedTopic?.autoPlay) {
      // Small delay to ensure player is ready
      setTimeout(() => {
        setIsPlaying(true);
      }, 100);
    }
  }, [selectedTopic]);

  // State-driven playback effect for Play All mode
  useEffect(() => {
    if (!isPlayingAll || !playerReady || topics.length === 0) return;

    const currentTopic = topics[playAllIndex];
    if (!currentTopic || currentTopic.segments.length === 0) return;

    // Select the topic in the UI (with fromPlayAll flag to prevent state reset)
    onTopicSelect?.(currentTopic, true);

    // Small delay to ensure player is ready
    setTimeout(() => {
      // Seek to the start of the topic's segment and play
      const segment = currentTopic.segments[0];
      setCurrentTime(segment.start);
      setIsPlaying(true);
    }, 100);
  }, [isPlayingAll, playAllIndex, playerReady]);

  // Simulate time progression when playing
  useEffect(() => {
    if (!isPlaying) {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
      return;
    }

    // Start time update interval
    let lastUpdateTime = currentTime;
    timeUpdateIntervalRef.current = setInterval(() => {
      // Skip updates while seeking to prevent feedback loops
      if (isSeekingRef.current) return;

      const newTime = currentTime + 0.1; // Simulate time progression

      // Always update internal current time for progress bar
      setCurrentTime(newTime);

      // Handle Play All mode auto-transitions
      if (isPlayingAllRef.current && topicsRef.current.length > 0) {
        const currentIndex = playAllIndexRef.current;
        const currentTopic = topicsRef.current[currentIndex];
        if (currentTopic && currentTopic.segments.length > 0) {
          const segment = currentTopic.segments[0];

          // Check if we've reached the end of the current segment
          if (newTime >= segment.end) {
            const isLastTopic = currentIndex >= topicsRef.current.length - 1;
            if (isLastTopic) {
              // End Play All mode
              setIsPlayingAll?.(false);
              isPlayingAllRef.current = false;
              setIsPlaying(false);
            } else {
              // Advance to the next topic
              const nextIndex = currentIndex + 1;
              playAllIndexRef.current = nextIndex;
              setPlayAllIndex?.(nextIndex);
            }
          }
        }
      }

      // Throttle external updates to reduce re-renders
      const timeDiff = Math.abs(newTime - lastUpdateTime);
      if (timeDiff >= 0.5) {
        lastUpdateTime = newTime;
        onTimeUpdate?.(newTime);
      }
    }, 100);

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    };
  }, [isPlaying, currentTime, onTimeUpdate]);

  // Monitor playback to handle citation reel transitions
  useEffect(() => {
    if (!selectedTopic || !isPlaying) return;

    // Don't set up monitoring during play-all mode (handled by time update logic)
    if (isPlayingAll) return;

    // Handle citation reels with multiple segments
    if (selectedTopic.isCitationReel && selectedTopic.segments.length > 0) {
      const monitoringInterval = setInterval(() => {
        const currentSegment = selectedTopic.segments[citationReelSegmentIndex];

        if (!currentSegment) return;

        // Check if we've reached the end of the current segment
        if (currentTime >= currentSegment.end) {
          // Check if there are more segments to play
          if (citationReelSegmentIndex < selectedTopic.segments.length - 1) {
            // Move to the next segment
            const nextIndex = citationReelSegmentIndex + 1;
            setCitationReelSegmentIndex(nextIndex);
            const nextSegment = selectedTopic.segments[nextIndex];

            // Seek to the start of the next segment
            setCurrentTime(nextSegment.start);
          } else {
            // This was the last segment, pause the video
            setIsPlaying(false);

            // Clear the monitoring interval
            clearInterval(monitoringInterval);

            // Reset the segment index for next playback
            setCitationReelSegmentIndex(0);
          }
        }
      }, 100); // Check every 100ms

      // Clean up on unmount or when dependencies change
      return () => {
        clearInterval(monitoringInterval);
      };
    }
  }, [selectedTopic, isPlaying, isPlayingAll, citationReelSegmentIndex, currentTime]);

  const playTopic = (topic: Topic) => {
    if (!topic || topic.segments.length === 0) return;

    // If clicking a topic manually, exit play all mode
    if (isPlayingAll) {
      setIsPlayingAll?.(false);
    }

    // Seek to the start of the single segment and play
    const segment = topic.segments[0];
    setCurrentTime(segment.start);
    setIsPlaying(true);
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    isSeekingRef.current = true;

    // Reset seeking flag after a short delay
    setTimeout(() => {
      isSeekingRef.current = false;
    }, 100);
  };

  const getBilibiliEmbedUrl = () => {
    // Bilibili embed URL format
    if (videoId.startsWith('BV')) {
      return `https://player.bilibili.com/player.html?bvid=${videoId}&page=1&high_quality=1&danmaku=0`;
    } else if (videoId.startsWith('av')) {
      return `https://player.bilibili.com/player.html?aid=${videoId.substring(2)}&page=1&high_quality=1&danmaku=0`;
    }
    return `https://player.bilibili.com/player.html?bvid=${videoId}&page=1&high_quality=1&danmaku=0`;
  };

  return (
    <div className="w-full">
      <Card className="overflow-hidden shadow-sm p-0">
        <div className="relative bg-black overflow-hidden aspect-video">
          <iframe
            ref={iframeRef}
            src={getBilibiliEmbedUrl()}
            className="absolute top-0 left-0 w-full h-full"
            allowFullScreen
            scrolling="no"
            frameBorder="no"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>

        {renderControls && (
          <div className="p-3 bg-background border-t flex-shrink-0">
            {videoDuration > 0 && (
              <VideoProgressBar
                videoDuration={videoDuration}
                currentTime={currentTime}
                topics={topics}
                selectedTopic={selectedTopic}
                onSeek={handleSeek}
                onTopicSelect={onTopicSelect}
                onPlayTopic={playTopic}
                transcript={transcript}
                videoId={videoId}
              />
            )}

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="ml-3 flex items-center gap-2">
                  <span className="text-sm font-mono text-muted-foreground">
                    {formatDuration(currentTime)} / {formatDuration(videoDuration)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {isPlaying ? '播放中' : '已暂停'}
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}