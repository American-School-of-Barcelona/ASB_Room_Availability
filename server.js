const path = require("path");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const sqlite3 = require("sqlite3").verbose();

const app = express();
const dbPath = path.join(__dirname, "Computer Science IA - 2.db MODIFIED.db");
const db = new sqlite3.Database(dbPath);

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const sessionSecret = process.env.SESSION_SECRET || "dev-secret";

if (!clientId || !clientSecret) {
  console.warn("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables.");
}

db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS Users (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
      "googleId TEXT UNIQUE, " +
      "email TEXT UNIQUE, " +
      "name TEXT, " +
      "photo TEXT, " +
      "lastLogin TEXT" +
    ")"
  );
});

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  db.get("SELECT * FROM Users WHERE id = ?", [id], (err, row) => {
    done(err, row || null);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: clientId,
      clientSecret: clientSecret,
      callbackURL: "/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      const photo = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
      const googleId = profile.id;
      const name = profile.displayName || "";
      const now = new Date().toISOString();

      db.get("SELECT * FROM Users WHERE googleId = ?", [googleId], (err, row) => {
        if (err) {
          return done(err);
        }
        if (row) {
          db.run(
            "UPDATE Users SET email = ?, name = ?, photo = ?, lastLogin = ? WHERE id = ?",
            [email, name, photo, now, row.id],
            (updateErr) => {
              if (updateErr) {
                return done(updateErr);
              }
              return done(null, { ...row, email, name, photo, lastLogin: now });
            }
          );
          return;
        }
        db.run(
          "INSERT INTO Users (googleId, email, name, photo, lastLogin) VALUES (?, ?, ?, ?, ?)",
          [googleId, email, name, photo, now],
          function onInsert(insertErr) {
            if (insertErr) {
              return done(insertErr);
            }
            db.get("SELECT * FROM Users WHERE id = ?", [this.lastID], (getErr, newRow) => {
              done(getErr, newRow || null);
            });
          }
        );
      });
    }
  )
);

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: "lax",
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/login.css", (req, res) => {
  res.sendFile(path.join(__dirname, "login.css"));
});

app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    res.redirect("/");
  }
);

app.get("/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.redirect("/login.html");
    });
  });
});

app.use((req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login.html");
});

function queryAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

app.get("/api/data", async (req, res) => {
  try {
    const [rooms, classInfo, schedules] = await Promise.all([
      queryAll("SELECT * FROM RoomInfo"),
      queryAll("SELECT * FROM ClassInfo"),
      queryAll("SELECT * FROM ClassSchedule"),
    ]);
    res.set("Cache-Control", "no-store");
    res.json({ rooms, classInfo, schedules });
  } catch (error) {
    res.status(500).json({ error: "Failed to load data" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use(express.static(__dirname));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
