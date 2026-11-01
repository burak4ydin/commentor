// Single-line comment
fn main() {
    /* block comment */
    let x: i32 = 42; // answer to everything
    let _s: &'static str = "hello"; // lifetime annotation kept
    let ch = 'a'; // char literal, not a lifetime
    println!("{}", x); // output
}