<?php

class Router
{
    /** @var array<int, array{method:string, pattern:string, handler:callable}> */
    private array $routes = [];

    public function addRoute(string $method, string $pattern, callable $handler): void
    {
        $this->routes[] = [
            'method' => strtoupper($method),
            'pattern' => $pattern,
            'handler' => $handler,
        ];
    }

    public function get(string $pattern, callable $handler): void
    {
        $this->addRoute('GET', $pattern, $handler);
    }

    public function post(string $pattern, callable $handler): void
    {
        $this->addRoute('POST', $pattern, $handler);
    }

    public function put(string $pattern, callable $handler): void
    {
        $this->addRoute('PUT', $pattern, $handler);
    }

    public function delete(string $pattern, callable $handler): void
    {
        $this->addRoute('DELETE', $pattern, $handler);
    }

    public function dispatch(string $method, array $segments): void
    {
        $path = '/' . implode('/', $segments);
        if ($path === '//') {
            $path = '/';
        }

        foreach ($this->routes as $route) {
            if ($route['method'] !== strtoupper($method)) {
                continue;
            }

            $regex = $this->buildRegex($route['pattern']);
            if (preg_match($regex, $path, $matches) === 1) {
                $params = [];
                foreach ($matches as $key => $value) {
                    if (is_string($key)) {
                        $params[$key] = $value;
                    }
                }

                $route['handler']($params);
                return;
            }
        }

        throw new RuntimeException('Not found', 404);
    }

    private function buildRegex(string $pattern): string
    {
        $regex = '';
        $offset = 0;

        while (true) {
            $start = strpos($pattern, '{', $offset);
            if ($start === false) {
                $regex .= preg_quote(substr($pattern, $offset), '/');
                break;
            }

            $end = strpos($pattern, '}', $start);
            if ($end === false) {
                $regex .= preg_quote(substr($pattern, $offset), '/');
                break;
            }

            $regex .= preg_quote(substr($pattern, $offset, $start - $offset), '/');
            $paramName = substr($pattern, $start + 1, $end - $start - 1);
            $regex .= '(?P<' . $paramName . '>[^/]+)';
            $offset = $end + 1;
        }

        return '/^' . $regex . '$/';
    }
}
