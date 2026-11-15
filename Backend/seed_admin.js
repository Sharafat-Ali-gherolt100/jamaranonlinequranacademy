const bcrypt = require("bcryptjs");
const pool = require("./db");

async function seedAdmin() {
  try {
    const username = process.env.ADMIN_DEFAULT_USER || "admin";
    const password = process.env.ADMIN_DEFAULT_PASSWORD || "Admin@Jamaran2026!";
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Check if admin already exists
    const [rows] = await pool.query("SELECT admin_id, username FROM admins WHERE username = ?", [username]);

    if (rows.length === 0) {
      await pool.query(
        "INSERT INTO admins (username, password_hash) VALUES (?, ?)",
        [username, passwordHash]
      );
      console.log(`Admin account created: '${username}' with password: '${password}'`);
    } else {
      await pool.query(
        "UPDATE admins SET password_hash = ? WHERE username = ?",
        [passwordHash, username]
      );
      console.log(`Admin account '${username}' updated with password: '${password}'`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Admin seed error:", error.message);
    process.exit(1);
  }
}

seedAdmin();
