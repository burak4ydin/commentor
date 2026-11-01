// Package main demonstrates comment stripping.
package main

import "fmt" // standard library

// greet prints a greeting to stdout.
func greet(name string) {
	/* format and print */
	fmt.Printf("Hello, %s!\n", name) // output line
}

func main() {
	// call greet
	greet("world")
}