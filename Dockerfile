# OPORTAL — Pure JS static site served by nginx
# docker build -t oportal .
# docker run -p 3000:80 oportal

FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1
