# FluxSnip

Gmail、Microsoft Teams（PWA版）、Google Chat（PWA版）向けキーワード展開型定型文Chrome拡張機能。

## 主な機能
- **キーワード + Tab 展開**: 短いキーワードの入力後にTabキーを押すだけで即座に定型文を挿入。
- **検索ピッカー**: ショートカットキーで素早く定型文を検索・挿入。
- **Gmail連携**: To/Cc/Bccの置き換え・追記、Fromエイリアスの切り替え、件名の自動設定。
- **Teams & Google Chat対応**: テーブルを含むリッチテキストや書式付きテキストの挿入に対応。
- **ランタイム依存ゼロ**: 外部通信なし・外部ライブラリなしで高い安全性と動作速度を両立。
- **端末ローカル保存**: テンプレートや設定はすべてブラウザ内にローカル保存。

## 開発コマンド

```bash
# 依存パッケージのインストール
npm install

# 型チェック
npm run compile

# 単体テスト
npm test

# ビルド
npm run build

# 開発モード起動
npm run dev

# 配布用zip作成
npm run zip
```

## ライセンス
[MIT License](./LICENSE)
