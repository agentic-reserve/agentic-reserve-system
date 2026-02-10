[0mExpected type did not match the received type.[0m

[0mErroneous code examples:[0m

[0m[0m[2mfn plus_one(x: i32) -> i32 {
    x + 1
}

plus_one("Not a number");
//       ^^^^^^^^^^^^^^ expected `i32`, found `&str`

if "Not a bool" {
// ^^^^^^^^^^^^ expected `bool`, found `&str`
}

let x: f32 = "Not a float";
//     ---   ^^^^^^^^^^^^^ expected `f32`, found `&str`
//     |
//     expected due to this[0m

[0mThis error occurs when an expression was used in a place where the compiler[0m [0mexpected an expression of a different type. It can occur in
several cases, the[0m [0mmost common being when calling a function and passing an argument which has a[0m [0mdifferent type than the matching type in
the function declaration.[0m[0m
