# 🐢 Turtle Trading Journal

けんた専用のトレード記録・ダッシュボードWebアプリです。

## 主な機能
- エントリー時：日付、銘柄、Long/Short、エントリー価格、SL、エントリー理由、退出条件、画像
- 決済後：決済価格、損益、損益率、保有時間、感情
- RR自動計算
- 現在の月を自動判定
- 今月損益、月間損益率、トレード数、勝率、平均RRを自動集計
- 銘柄別損益
- 月別履歴
- 開始資産 $60
- ブラウザのlocalStorageへ保存

## GitHub Pagesで公開
1. GitHubで新しいRepositoryを作成
2. このフォルダ内の `index.html`, `style.css`, `app.js`, `manifest.json` をアップロード
3. Repository Settings → Pages → Deploy from a branch → main / root を選択
4. 数分後に公開URLが発行されます

## データについて
現在はブラウザのlocalStorage保存です。同じブラウザ・端末では保持されますが、別端末への自動同期はありません。
