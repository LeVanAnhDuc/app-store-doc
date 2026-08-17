/**
 * Trang tạm để nền dự án có ít nhất một route và CSS được biên dịch thật.
 * Task 7 thêm middleware chuyển `/` sang `/vi`, sau đó trang này thành lối vào dự phòng.
 */
export default function HomePage() {
  return (
    <main style={{ padding: "2rem", maxWidth: "var(--measure)" }}>
      <h1>app-store-doc</h1>
      <p>Nền dự án đã dựng xong. Nội dung công khai sẽ nằm ở `/vi` và `/en`.</p>
    </main>
  );
}
