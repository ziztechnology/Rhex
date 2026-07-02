"use client"

import { useEffect, useRef, useState } from "react"
import Cropper from "react-easy-crop"
import type { Area, Point } from "react-easy-crop"

import { Modal } from "@/components/ui/modal"
import { UserAvatar } from "@/components/user/user-avatar"
import { Button } from "@/components/ui/rbutton"
import { createAvatarCroppedFile, createAvatarCropPreviewUrl } from "@/lib/avatar-crop"

export interface AvatarCropModalProps {
  open: boolean
  imageSrc: string
  imageName?: string
  imageType?: string
  previewName: string
  onClose: () => void
  onConfirm: (file: File) => Promise<void>
  onUploadOriginal?: () => Promise<void>
}

function revokeObjectUrl(url: string | null) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url)
  }
}

export function AvatarCropModal({
  open,
  imageSrc,
  imageName,
  imageType,
  previewName,
  onClose,
  onConfirm,
  onUploadOriginal,
}: AvatarCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [minZoom, setMinZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const previewRequestIdRef = useRef(0)
  const previewTimeoutRef = useRef<number | null>(null)
  const previewUrlRef = useRef("")

  function updatePreviewUrl(nextUrl: string) {
    setPreviewUrl((current) => {
      if (current !== nextUrl) {
        revokeObjectUrl(current)
      }

      previewUrlRef.current = nextUrl
      return nextUrl
    })
  }

  function resolveFitZoom(naturalWidth: number, naturalHeight: number) {
    const longestEdge = Math.max(naturalWidth, naturalHeight)
    const shortestEdge = Math.min(naturalWidth, naturalHeight)

    if (longestEdge <= 0 || shortestEdge <= 0) {
      return 1
    }

    return Math.max(0.25, Math.min(1, shortestEdge / longestEdge))
  }

  function schedulePreview(areaPixels: Area) {
    setCroppedAreaPixels(areaPixels)
    previewRequestIdRef.current += 1
    const requestId = previewRequestIdRef.current

    if (previewTimeoutRef.current) {
      window.clearTimeout(previewTimeoutRef.current)
    }

    setPreviewLoading(true)
    previewTimeoutRef.current = window.setTimeout(async () => {
      if (!open) {
        return
      }

      try {
        const nextPreviewUrl = await createAvatarCropPreviewUrl({
          imageSrc,
          cropArea: areaPixels,
          mimeType: imageType,
        })

        if (previewRequestIdRef.current !== requestId) {
          revokeObjectUrl(nextPreviewUrl)
          return
        }

        updatePreviewUrl(nextPreviewUrl)
      } catch {
        if (previewRequestIdRef.current === requestId) {
          updatePreviewUrl("")
        }
      } finally {
        if (previewRequestIdRef.current === requestId) {
          setPreviewLoading(false)
        }
      }
    }, 120)
  }

  useEffect(() => {
    return () => {
      previewRequestIdRef.current += 1
      if (previewTimeoutRef.current) {
        window.clearTimeout(previewTimeoutRef.current)
      }
      revokeObjectUrl(previewUrlRef.current)
      previewUrlRef.current = ""
    }
  }, [])

  async function handleConfirm() {
    if (!croppedAreaPixels) {
      return
    }

    setSaving(true)

    try {
      const croppedFile = await createAvatarCroppedFile({
        imageSrc,
        cropArea: croppedAreaPixels,
        fileName: imageName,
        mimeType: imageType,
      })

      await onConfirm(croppedFile)
    } catch {
      // Parent handles user-facing error messages.
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadOriginal() {
    if (!onUploadOriginal) {
      return
    }

    setSaving(true)

    try {
      await onUploadOriginal()
    } catch {
      // Parent handles user-facing error messages.
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="剪裁头像"
      hideHeaderCloseButtonOnMobile
      description="可以直接使用原图，或调整取景后剪裁保存。提交成功后头像立即生效。"
      size="xl"
      closeDisabled={saving}
      footer={(
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          {onUploadOriginal ? (
            <Button type="button" variant="outline" onClick={handleUploadOriginal} disabled={saving}>
              {saving ? "保存中..." : "不剪裁提交保存"}
            </Button>
          ) : null}
          <Button type="button" onClick={handleConfirm} disabled={saving || !croppedAreaPixels}>
            {saving ? "保存中..." : "剪裁并提交保存"}
          </Button>
        </div>
      )}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_320px]">
        <div className="space-y-3">
          <div className="relative h-[360px] overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.03),rgba(15,23,42,0.08))]">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              zoomWithScroll
              minZoom={minZoom}
              restrictPosition={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, areaPixels) => schedulePreview(areaPixels)}
              onMediaLoaded={({ naturalWidth, naturalHeight }) => {
                const nextMinZoom = resolveFitZoom(naturalWidth, naturalHeight)
                setMinZoom(nextMinZoom)
                setZoom(nextMinZoom)
                setCrop({ x: 0, y: 0 })
              }}
              objectFit="contain"
            />
          </div>
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">缩放</p>
                <p className="mt-1 text-xs text-muted-foreground">拖拽头像区域并放大，确认最终取景。</p>
              </div>
              <span className="text-sm font-semibold text-foreground">{zoom.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={minZoom}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="mt-4 w-full accent-foreground"
              aria-label="头像裁剪缩放"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium">裁剪结果预览</p>
            <p className="mt-1 text-xs text-muted-foreground">提交保存前，先看一下三种尺寸下的显示效果。</p>
            <div className="mt-4 space-y-4">
              <PreviewSize label="大尺寸" size="lg" avatarPath={previewUrl} name={previewName} loading={previewLoading} />
              <PreviewSize label="中尺寸" size="md" avatarPath={previewUrl} name={previewName} loading={previewLoading} />
              <PreviewSize label="小尺寸" size="sm" avatarPath={previewUrl} name={previewName} loading={previewLoading} />
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-border bg-background/70 p-4 text-xs leading-6 text-muted-foreground">
            <p>1. 头像会按你当前裁剪结果导出为正方形图片。</p>
            <p>2. 建议把主体放在圆形框中央，避免小尺寸下边缘被裁掉。</p>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function PreviewSize({
  label,
  size,
  avatarPath,
  name,
  loading,
}: {
  label: string
  size: "lg" | "md" | "sm"
  avatarPath?: string
  name: string
  loading: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[18px] border border-border bg-background/80 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{size === "lg" ? "64px" : size === "md" ? "44px" : "36px"} 预览</p>
      </div>
      <div className={loading ? "opacity-60" : ""}>
        <UserAvatar name={name} avatarPath={avatarPath} size={size} />
      </div>
    </div>
  )
}
