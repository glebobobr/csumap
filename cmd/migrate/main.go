package main

import (
	"flag"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	direction := flag.String("direction", "up", "up | down | version")
	steps := flag.Int("steps", 0, "number of steps (0 = all)")
	migrationsPath := flag.String("path", "file://migrations/schema", "path to migrations")
	flag.Parse()

	dbURL := os.Getenv("CSUMAP_DATABASE_DSN")
	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
	}
	if dbURL == "" {
		log.Fatal("DATABASE_URL or CSUMAP_DATABASE_DSN environment variable is required")
	}

	m, err := migrate.New(
		*migrationsPath,
		dbURL,
	)
	if err != nil {
		log.Fatalf("migrate init: %v", err)
	}
	defer m.Close()

	version, dirty, _ := m.Version()
	log.Printf("Current version: %d, dirty: %v", version, dirty)

	switch *direction {
	case "up":
		if *steps > 0 {
			err = m.Steps(*steps)
		} else {
			err = m.Up()
		}
	case "down":
		if *steps > 0 {
			err = m.Steps(-(*steps))
		} else {
			err = m.Down()
		}
	case "version":
		v, d, e := m.Version()
		log.Printf("Version: %d, dirty: %v, err: %v", v, d, e)
		return
	case "force":
		if *steps > 0 {
			err = m.Force(*steps)
		} else {
			log.Fatal("force requires -steps <version>")
		}
	default:
		log.Fatalf("unknown direction: %s", *direction)
	}

	if err != nil {
		if err == migrate.ErrNoChange {
			log.Println("No changes to apply")
		} else {
			log.Fatalf("migrate %s: %v", *direction, err)
		}
	} else {
		log.Println("Migrations applied successfully")
	}
}