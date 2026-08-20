#!/usr/bin/env bash
# ============================================================
# Transforma um clipe .mp4 na sequência de frames do hero.
#
#   ./scripts/extrair-frames.sh caminho/do/clipe.mp4
#
# No final ele imprime quantos frames saíram. Esse número tem que
# ser o mesmo que está em CONFIG.frameCount, no js/main.js.
# ============================================================
set -euo pipefail

CLIPE="${1:-}"
FPS="${2:-24}"        # 24 dá cinema; 30 fica mais liso e pesa mais
LARGURA="${3:-1280}"  # 1280 basta pro hero; 1600 só se for tela grande

if [[ -z "$CLIPE" ]]; then
  echo "uso: $0 <clipe.mp4> [fps] [largura]"
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg não encontrado."
  echo "  macOS:   brew install ffmpeg"
  echo "  Windows: winget install Gyan.FFmpeg"
  echo "  Linux:   sudo apt install ffmpeg"
  exit 1
fi

DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$DIR/assets/frames"

rm -f "$DEST"/hero_*.jpg
mkdir -p "$DEST" "$DIR/assets/video" "$DIR/assets/img"

# frames da sequência (o que o canvas pinta no desktop)
ffmpeg -hide_banner -loglevel error -i "$CLIPE" \
  -vf "fps=$FPS,scale=$LARGURA:-2" -q:v 6 \
  "$DEST/hero_%04d.jpg"

# versão em vídeo, que é o que o mobile usa
ffmpeg -hide_banner -loglevel error -y -i "$CLIPE" \
  -vf "scale=$LARGURA:-2" -c:v libx264 -pix_fmt yuv420p -crf 28 \
  -movflags +faststart -an "$DIR/assets/video/hero.mp4"

# primeiro quadro vira poster, pra tela não ficar preta enquanto carrega
ffmpeg -hide_banner -loglevel error -y -i "$CLIPE" \
  -vf "scale=$LARGURA:-2" -frames:v 1 -q:v 4 "$DIR/assets/img/hero-poster.jpg"

N=$(ls "$DEST" | grep -c '^hero_.*\.jpg$')
PESO=$(du -sh "$DEST" | cut -f1)

echo
echo "✓ $N frames em assets/frames ($PESO)"
echo "✓ assets/video/hero.mp4 e assets/img/hero-poster.jpg atualizados"
echo
echo "AGORA: abra js/main.js e deixe frameCount: $N"
[[ "$N" -gt 150 ]] && echo "AVISO: acima de 150 frames o hero fica pesado. Baixe o fps."
exit 0
