package domain

import "errors"

var (
	ErrNotFound        = errors.New("resource not found")
	ErrUnauthorized    = errors.New("unauthorized")
	ErrInvalidInput    = errors.New("invalid input")
	ErrDuplicate       = errors.New("resource already exists")
	ErrForbidden       = errors.New("forbidden")
	ErrTokenExpired    = errors.New("token expired")
	ErrInvalidFile     = errors.New("invalid file format")
)
