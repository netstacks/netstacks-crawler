FROM perl:5.38-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN sed -i 's|^Components: main$|Components: main contrib non-free non-free-firmware|' \
        /etc/apt/sources.list.d/debian.sources \
 && apt-get update && apt-get install -y --no-install-recommends \
      build-essential libpq-dev libssl-dev libffi-dev \
      libsnmp-dev snmp snmp-mibs-downloader \
      libldap2-dev libsasl2-dev \
      python3 python3-pip pipx \
      curl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/* \
 && pipx install uv && ln -s /root/.local/bin/uv /usr/local/bin/uv

ENV PERL_CPANM_OPT="--no-interactive --notest"
RUN cpanm App::cpanminus Carton

WORKDIR /opt/crawler

COPY Build.PL META.json META.yml ./
COPY lib ./lib

RUN mkdir -p "$(perl -e 'print $INC[0]')/Alien" \
 && cp lib/Alien/ultraviolet.pm "$(perl -e 'print $INC[0]')/Alien/ultraviolet.pm" \
 && chmod 644 "$(perl -e 'print $INC[0]')/Alien/ultraviolet.pm" \
 && cpanm --installdeps . \
 && cpanm Alien::SNMP

COPY share ./share
COPY bin ./bin

RUN perl Build.PL \
 && ./Build \
 && ./Build install \
 && find /usr/local/lib -path '*App-Crawler/environments/deployment.yml' -delete

# Vendor-organized MIB tree. Netdisco's SNMP::Info backend resolves OIDs by
# walking $CRAWLER_HOME/netdisco-mibs/<vendor>/ — without this tree, every
# discover job dies with "MIB search path: " (empty) and "Cannot find module
# (IF-MIB)". Debian's /var/lib/mibs only has ietf/iana, wrong layout.
ARG NETDISCO_MIBS_VERSION=4.055
RUN curl -fsSL -o /tmp/nd-mibs.tgz \
      "https://github.com/netdisco/netdisco-mibs/archive/refs/tags/${NETDISCO_MIBS_VERSION}.tar.gz" \
 && mkdir -p /opt/crawler/netdisco-mibs \
 && tar -xzf /tmp/nd-mibs.tgz -C /opt/crawler/netdisco-mibs --strip-components=1 \
 && rm /tmp/nd-mibs.tgz

RUN useradd -r -u 901 -m -d /home/crawler -s /bin/bash crawler \
 && mkdir -p /etc/crawler /var/log/crawler \
 && chown -R crawler:crawler /opt/crawler /etc/crawler /var/log/crawler

USER crawler
ENV CRAWLER_HOME=/opt/crawler
# Netdisco scripts require either PERL_LOCAL_LIB_ROOT or PERLBREW_PERL to be
# set to bypass their localenv lookup. We install to system perl so neither
# is set naturally; PERLBREW_PERL=system is a no-op marker for the check.
ENV PERLBREW_PERL=system

ENTRYPOINT ["/usr/bin/tini","--","/opt/crawler/bin/entrypoint.pl"]

EXPOSE 5000

# Default role is the API backend (runs DB bootstrap then the web app).
# The `worker` service overrides this via `command:` in docker-compose.yaml.
CMD ["sh","-c","crawler-bootstrap-db && exec starman --listen :5000 --workers 2 --disable-keepalive /usr/local/bin/crawler-web-fg"]
